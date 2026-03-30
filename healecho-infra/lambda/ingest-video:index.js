// healecho-infra/lambda/ingest-video/index.js
// 목적: S3 업로드(ObjectCreated) 이벤트를 받아 동영상 포맷을 점검하고,
//       mp4/H.264가 아니면 MediaConvert Job을 생성해 표준 mp4(H.264/AAC)로 변환.
// 확인 방법:
// 1) S3에 uploads/ 경로로 .mov 등 올리기 → Lambda 로그에 "Submitting MediaConvert job..." 출력
// 2) 변환 완료 후 S3의 transcoded/ 경로에 mp4 생성 확인
// 3) .mp4 + video/mp4 인 경우는 "No transcode needed" 로그 확인

const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3");
const {
  MediaConvertClient,
  DescribeEndpointsCommand,
  CreateJobCommand,
} = require("@aws-sdk/client-mediaconvert");

const s3 = new S3Client({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  const rec = event.Records?.[0];
  if (!rec) return;

  const bucket = rec.s3.bucket.name;
  const key = decodeURIComponent(rec.s3.object.key.replace(/\+/g, " "));

  console.log("New object:", { bucket, key });

  // 1) 메타데이터로 1차 판별 (Content-Type / 확장자)
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const contentType = head.ContentType || "";
  const ext = (key.split(".").pop() || "").toLowerCase();

  const isMp4ByExt = ext === "mp4";
  const isMp4ByMime = contentType.startsWith("video/mp4");

  // 간단 정책:
  // - mp4+video/mp4 이면 통과(트랜스코딩 생략)
  // - 그 외(예: mov/avi/hevc 등)는 H.264 mp4로 변환
  if (isMp4ByExt && isMp4ByMime && process.env.FORCE_TRANSCODE !== "true") {
    console.log("No transcode needed (mp4 detected).");
    return;
  }

  // 2) MediaConvert 엔드포인트 획득
  const mc = new MediaConvertClient({ region: process.env.AWS_REGION });
  const { Endpoints } = await mc.send(new DescribeEndpointsCommand({ MaxResults: 1 }));
  mc.config.endpoint = Endpoints[0].Url;

  // 3) 출력 경로/파일명 설정
  const fileBase = key.split("/").pop().replace(/\.[^.]+$/, ""); // 확장자 제거
  const destination = `s3://${bucket}/transcoded/`;

  // 4) MediaConvert 잡 생성 (H.264/AAC, MP4 컨테이너)
  const params = {
    Role: process.env.MEDIACONVERT_ROLE_ARN, // CDK에서 주입
    Settings: {
      Inputs: [
        {
          FileInput: `s3://${bucket}/${key}`,
          AudioSelectors: { "Audio Selector 1": { DefaultSelection: "DEFAULT" } },
          VideoSelector: {},
        },
      ],
      OutputGroups: [
        {
          Name: "File Group",
          OutputGroupSettings: {
            Type: "FILE_GROUP_SETTINGS",
            FileGroupSettings: {
              Destination: destination,
            },
          },
          Outputs: [
            {
              ContainerSettings: { Container: "MP4" },
              VideoDescription: {
                CodecSettings: {
                  Codec: "H_264",
                  H264Settings: {
                    RateControlMode: "QVBR",
                    SceneChangeDetect: "TRANSITION_DETECTION",
                    MaxBitrate: 12000000, // 12 Mbps (필요 시 조정)
                    QvbrQualityLevel: 7,
                  },
                },
              },
              AudioDescriptions: [
                {
                  CodecSettings: {
                    Codec: "AAC",
                    AacSettings: {
                      Bitrate: 192000,
                      CodingMode: "CODING_MODE_2_0",
                      SampleRate: 48000,
                    },
                  },
                },
              ],
              NameModifier: "_h264", // 예: sample_h264.mp4
            },
          ],
        },
      ],
    },
    StatusUpdateInterval: "SECONDS_60",
    Queue: process.env.MEDIACONVERT_QUEUE_ARN || undefined, // (옵션) 커스텀 큐 사용 시
    Tags: { Project: "Healecho" },
  };

  console.log("Submitting MediaConvert job...");
  const job = await mc.send(new CreateJobCommand(params));
  console.log("Job submitted:", job.Job?.Id);
};
