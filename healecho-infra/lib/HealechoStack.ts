import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import {
  aws_s3 as s3,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_iam as iam,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_cognito as cognito,
  aws_events as events,
  aws_events_targets as targets,
  aws_backup as backup,                           // ✅ 백업: AWS Backup 서비스
  aws_budgets as budgets,                         // ✅ 비용 알림
} from "aws-cdk-lib";

import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

import {
  HttpApi,
  HttpMethod,
  CorsHttpMethod,
} from "@aws-cdk/aws-apigatewayv2-alpha";
import { HttpLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import { HttpUserPoolAuthorizer } from "@aws-cdk/aws-apigatewayv2-authorizers-alpha";

export class HealechoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* ===============================
       S3 Buckets
    =============================== */
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,                            // ✅ 백업: 버전 관리 활성화
      removalPolicy: cdk.RemovalPolicy.RETAIN,    // ✅ 백업: 스택 삭제 시 버킷 보존
      autoDeleteObjects: false,                    // ✅ 백업: 자동 삭제 비활성화
    });

    const videoBucket = new s3.Bucket(this, "VideoBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,                            // ✅ 백업: 버전 관리 활성화 (영상 콘텐츠 보호)
      removalPolicy: cdk.RemovalPolicy.RETAIN,    // ✅ 백업: 스택 삭제 시 버킷 보존
      autoDeleteObjects: false,                    // ✅ 백업: 자동 삭제 비활성화
      lifecycleRules: [                            // ✅ 백업: 이전 버전 90일 후 자동 정리 (비용 절약)
        {
          noncurrentVersionExpiration: cdk.Duration.days(90),
          noncurrentVersionsToRetain: 3,
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ["*", "http://localhost:3000"],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
    });

    /* ===============================
       CloudFront
    =============================== */
    const oai = new cloudfront.OriginAccessIdentity(this, "OAI");

    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`${siteBucket.bucketArn}/*`],
        principals: [
          new iam.CanonicalUserPrincipal(
            oai.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    videoBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`${videoBucket.bucketArn}/*`],
        principals: [
          new iam.CanonicalUserPrincipal(
            oai.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    const videoOrigin = new origins.S3Origin(videoBucket, {
      originAccessIdentity: oai,
    });

    new cloudfront.Distribution(this, "WebDistribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket, {
          originAccessIdentity: oai,
        }),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        "videos/*": {
          origin: videoOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods:
            cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        "uploads/*": {
          origin: videoOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods:
            cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        "thumbnails/*": {
          origin: videoOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods:
            cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        /* ── 위클리 해빗 영상 경로 (Phase 1-4) ── */
        "weekly-habit/*": {
          origin: videoOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods:
            cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
    });

    /* ===============================
       DynamoDB
    =============================== */
    const itemsTable = new dynamodb.Table(this, "ItemsTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,    // ✅ 백업: 스택 삭제 시 테이블 보존
      pointInTimeRecovery: true,                   // ✅ 백업: 35일 시점 복구 활성화
    });

    const balanceVideosTable = new dynamodb.Table(this, "BalanceVideosTable", {
      partitionKey: { name: "program", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "weekNumber", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,    // ✅ 백업: 스택 삭제 시 테이블 보존
      pointInTimeRecovery: true,                   // ✅ 백업: 35일 시점 복구 활성화
    });

    /* ── 구독 상태 테이블 ── */
    const subscriptionsTable = new dynamodb.Table(this, "SubscriptionsTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "programId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    /* ── 결제 테이블 ── */
    const paymentsTable = new dynamodb.Table(this, "PaymentsTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "paymentId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    /* ── 회원 관리 테이블 ── */
    const usersTable = new dynamodb.Table(this, "UsersTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // 이메일로 회원 검색용 GSI
    usersTable.addGlobalSecondaryIndex({
      indexName: "email-index",
      partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
    });

    // 고객 유형별 필터 + 가입일순 정렬용 GSI
    usersTable.addGlobalSecondaryIndex({
      indexName: "type-createdAt-index",
      partitionKey: { name: "subscriptionType", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
    });

    const watchRecordsTable = new dynamodb.Table(this, "WatchRecordsTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "watchDate", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    /* ── 위클리 해빗 테이블 (Phase 1-1) ── */
    const weeklyHabitContentTable = new dynamodb.Table(this, "WeeklyHabitContentTable", {
      partitionKey: { name: "program", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "weekNumber", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,    // ✅ 백업: 스택 삭제 시 테이블 보존
      pointInTimeRecovery: true,                   // ✅ 백업: 35일 시점 복구 활성화
    });

    const userHabitTrackingTable = new dynamodb.Table(this, "UserHabitTrackingTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "trackingKey", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    /* ── 수면 습관 테이블 (관리자 → 사용자 누적 표시) ── */
    const sleepHabitTable = new dynamodb.Table(this, "SleepHabitTable", {
      partitionKey: { name: "program", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "weekNumber", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,    // ✅ 백업: 스택 삭제 시 테이블 보존
      pointInTimeRecovery: true,                   // ✅ 백업: 35일 시점 복구 활성화
    });

    /* ===============================
       Cognito
    =============================== */
    const userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
    });

    // 하이브리드 소셜 로그인: 직접 카카오 OAuth → 서버에서 Cognito Admin API로 사용자 생성/인증
    // (Cognito OIDC Federation은 이메일 필수 제약으로 사용 불가)

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      generateSecret: false,
      authFlows: {
        userSrp: true,
        userPassword: true,
        adminUserPassword: true,   // 서버에서 AdminInitiateAuth 사용
      },
    });

    const authorizer = new HttpUserPoolAuthorizer(
      "HealechoAuthorizer",
      userPool,
      { userPoolClients: [userPoolClient] }
    );

    /* ===============================
       HTTP API
    =============================== */
    // CORS: 환경변수로 허용 origin 관리 (dev: localhost, prod: 실제 도메인)
    const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";

    const httpApi = new HttpApi(this, "HealechoHttpApi", {
      apiName: "HealechoHttpApi",
      corsPreflight: {
        allowOrigins: [allowedOrigin],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["Authorization", "Content-Type"],
      },
    });

    /* ===============================
       Multipart Lambdas (그대로 유지)
    =============================== */
    const mpInitiateLambda = new NodejsFunction(this, "AdminBalanceMultipartInitiateLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-balance-multipart-initiate.ts"),
      handler: "handler",
      environment: { UPLOAD_BUCKET: videoBucket.bucketName },
    });

    const mpPartLambda = new NodejsFunction(this, "AdminBalanceMultipartPartLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-balance-multipart-part.ts"),
      handler: "handler",
      environment: { UPLOAD_BUCKET: videoBucket.bucketName },
    });

    const mpCompleteLambda = new NodejsFunction(this, "AdminBalanceMultipartCompleteLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-balance-multipart-complete.ts"),
      handler: "handler",
      environment: { UPLOAD_BUCKET: videoBucket.bucketName },
    });

    videoBucket.grantReadWrite(mpInitiateLambda);
    videoBucket.grantReadWrite(mpPartLambda);
    videoBucket.grantReadWrite(mpCompleteLambda);

    httpApi.addRoutes({
      path: "/balance/videos/{program}/{weekNumber}/multipart/initiate",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("MpInit", mpInitiateLambda),
      authorizer,
    });

    httpApi.addRoutes({
      path: "/balance/videos/{program}/{weekNumber}/multipart/part",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("MpPart", mpPartLambda),
      authorizer,
    });

    httpApi.addRoutes({
      path: "/balance/videos/{program}/{weekNumber}/multipart/complete",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("MpComplete", mpCompleteLambda),
      authorizer,
    });

    /* ===============================
       Balance 목록 조회 (관리자)
    =============================== */
    const balanceListLambda = new NodejsFunction(this, "AdminBalanceListVideosLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-balance-list-videos.ts"),
      handler: "handler",
      environment: { BALANCE_TABLE_NAME: balanceVideosTable.tableName },
    });

    balanceVideosTable.grantReadData(balanceListLambda);

    httpApi.addRoutes({
      path: "/balance/videos/{program}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("BalanceList", balanceListLambda),
      authorizer,
    });

    /* ===============================
       ✅ Balance 업로드 완료 (DB 저장)
       🔥 여기만 authorizer 제거
    =============================== */
    const balanceCompleteLambda = new NodejsFunction(
      this,
      "AdminBalanceCompleteUploadLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(__dirname, "..", "lambda", "admin-balance-complete-upload.ts"),
        handler: "handler",
        environment: {
          BALANCE_VIDEOS_TABLE_NAME: balanceVideosTable.tableName,
        },
      }
    );

    balanceVideosTable.grantWriteData(balanceCompleteLambda);

    httpApi.addRoutes({
      path: "/balance/videos/{program}/{weekNumber}/complete",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "BalanceCompleteUploadIntegration",
        balanceCompleteLambda
      ),
      // ✅ authorizer intentionally removed
    });

    /* ===============================
       회원 관리 Lambdas
    =============================== */
    const listUsersLambda = new NodejsFunction(this, "AdminListUsersLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-list-users.ts"),
      handler: "handler",
      environment: {
        USERS_TABLE_NAME: usersTable.tableName,
        SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
    });

    const getUserLambda = new NodejsFunction(this, "AdminGetUserLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-get-user.ts"),
      handler: "handler",
      environment: {
        USERS_TABLE_NAME: usersTable.tableName,
        WATCH_RECORDS_TABLE_NAME: watchRecordsTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
    });

    const updateUserLambda = new NodejsFunction(this, "AdminUpdateUserLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-update-user.ts"),
      handler: "handler",
      environment: { USERS_TABLE_NAME: usersTable.tableName },
    });

    const getUserWatchRecordsLambda = new NodejsFunction(this, "AdminGetUserWatchRecordsLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-get-user-watch-records.ts"),
      handler: "handler",
      environment: { WATCH_RECORDS_TABLE_NAME: watchRecordsTable.tableName },
    });

    // DynamoDB 권한 부여
    usersTable.grantReadData(listUsersLambda);
    subscriptionsTable.grantReadData(listUsersLambda);
    usersTable.grantReadData(getUserLambda);
    usersTable.grantReadWriteData(updateUserLambda);
    watchRecordsTable.grantReadData(getUserLambda);
    watchRecordsTable.grantReadData(getUserWatchRecordsLambda);

    // Cognito 읽기 권한 (회원 목록/상세 조회용)
    const cognitoReadPolicy = new iam.PolicyStatement({
      actions: [
        "cognito-idp:ListUsers",
        "cognito-idp:AdminGetUser",
      ],
      resources: [userPool.userPoolArn],
    });
    listUsersLambda.addToRolePolicy(cognitoReadPolicy);
    getUserLambda.addToRolePolicy(cognitoReadPolicy);

    // API Gateway 경로 연결 (관리자 인증 필수)
    httpApi.addRoutes({
      path: "/admin/users",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("ListUsers", listUsersLambda),
      authorizer,
    });

    httpApi.addRoutes({
      path: "/admin/users/{userId}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetUser", getUserLambda),
      authorizer,
    });

    httpApi.addRoutes({
      path: "/admin/users/{userId}",
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration("UpdateUser", updateUserLambda),
      authorizer,
    });

    httpApi.addRoutes({
      path: "/admin/users/{userId}/watch-records",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetUserWatchRecords", getUserWatchRecordsLambda),
      authorizer,
    });

    /* ===============================
       Public Landing 영상 조회
    =============================== */
    const publicVideosLambda = new NodejsFunction(this, "PublicGetVideosLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "public-get-videos.ts"),
      handler: "handler",
      environment: { ITEMS_TABLE_NAME: itemsTable.tableName },
    });

    itemsTable.grantReadData(publicVideosLambda);

    httpApi.addRoutes({
      path: "/public/videos",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("PublicVideos", publicVideosLambda),
    });

    /* ===============================
       위클리 해빗 Lambdas (Phase 1-2, 1-3)
    =============================== */

    // 관리자: 주차별 습관 콘텐츠 CRUD
    const adminWeeklyHabitLambda = new NodejsFunction(this, "AdminWeeklyHabitContentLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-weekly-habit-content.ts"),
      handler: "handler",
      environment: {
        WEEKLY_HABIT_CONTENT_TABLE_NAME: weeklyHabitContentTable.tableName,
      },
    });

    weeklyHabitContentTable.grantReadWriteData(adminWeeklyHabitLambda);

    // 사용자: 주차별 습관 콘텐츠 조회
    const publicWeeklyHabitLambda = new NodejsFunction(this, "PublicWeeklyHabitContentLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "public-weekly-habit-content.ts"),
      handler: "handler",
      environment: {
        WEEKLY_HABIT_CONTENT_TABLE_NAME: weeklyHabitContentTable.tableName,
      },
    });

    weeklyHabitContentTable.grantReadData(publicWeeklyHabitLambda);

    // 사용자: 습관 체크 기록/조회
    const userHabitTrackingLambda = new NodejsFunction(this, "UserHabitTrackingLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "user-habit-tracking.ts"),
      handler: "handler",
      environment: {
        USER_HABIT_TRACKING_TABLE_NAME: userHabitTrackingTable.tableName,
      },
    });

    userHabitTrackingTable.grantReadWriteData(userHabitTrackingLambda);

    /* ── 위클리 해빗 Multipart 업로드 Lambda ── */
    const weeklyHabitMpInitiateLambda = new NodejsFunction(this, "WeeklyHabitMultipartInitiateLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-balance-multipart-initiate.ts"),
      handler: "handler",
      environment: { UPLOAD_BUCKET: videoBucket.bucketName },
    });

    const weeklyHabitMpPartLambda = new NodejsFunction(this, "WeeklyHabitMultipartPartLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-balance-multipart-part.ts"),
      handler: "handler",
      environment: { UPLOAD_BUCKET: videoBucket.bucketName },
    });

    const weeklyHabitMpCompleteLambda = new NodejsFunction(this, "WeeklyHabitMultipartCompleteLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-balance-multipart-complete.ts"),
      handler: "handler",
      environment: { UPLOAD_BUCKET: videoBucket.bucketName },
    });

    videoBucket.grantReadWrite(weeklyHabitMpInitiateLambda);
    videoBucket.grantReadWrite(weeklyHabitMpPartLambda);
    videoBucket.grantReadWrite(weeklyHabitMpCompleteLambda);

    /* ── 위클리 해빗 API Gateway 엔드포인트 (Phase 1-3) ── */

    // 관리자용 (인증 필요)
    // GET /admin/weekly-habit/{program} — 전체 주차 목록
    httpApi.addRoutes({
      path: "/admin/weekly-habit/{program}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("AdminWeeklyHabitList", adminWeeklyHabitLambda),
      authorizer,
    });

    // POST /admin/weekly-habit/{program}/{weekNumber} — 콘텐츠 등록
    httpApi.addRoutes({
      path: "/admin/weekly-habit/{program}/{weekNumber}",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("AdminWeeklyHabitCreate", adminWeeklyHabitLambda),
      authorizer,
    });

    // GET /admin/weekly-habit/{program}/{weekNumber} — 특정 주차 조회
    httpApi.addRoutes({
      path: "/admin/weekly-habit/{program}/{weekNumber}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("AdminWeeklyHabitGet", adminWeeklyHabitLambda),
      authorizer,
    });

    // PUT /admin/weekly-habit/{program}/{weekNumber} — 수정
    httpApi.addRoutes({
      path: "/admin/weekly-habit/{program}/{weekNumber}",
      methods: [HttpMethod.PUT],
      integration: new HttpLambdaIntegration("AdminWeeklyHabitUpdate", adminWeeklyHabitLambda),
      authorizer,
    });

    // DELETE /admin/weekly-habit/{program}/{weekNumber} — 삭제
    httpApi.addRoutes({
      path: "/admin/weekly-habit/{program}/{weekNumber}",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("AdminWeeklyHabitDelete", adminWeeklyHabitLambda),
      authorizer,
    });

    // 위클리 해빗 영상 Multipart 업로드 (관리자)
    httpApi.addRoutes({
      path: "/weekly-habit/videos/{program}/{weekNumber}/multipart/initiate",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("WeeklyHabitMpInit", weeklyHabitMpInitiateLambda),
      authorizer,
    });

    httpApi.addRoutes({
      path: "/weekly-habit/videos/{program}/{weekNumber}/multipart/part",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("WeeklyHabitMpPart", weeklyHabitMpPartLambda),
      authorizer,
    });

    httpApi.addRoutes({
      path: "/weekly-habit/videos/{program}/{weekNumber}/multipart/complete",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("WeeklyHabitMpComplete", weeklyHabitMpCompleteLambda),
      authorizer,
    });

    // 사용자용 (인증 필요)
    // GET /public/weekly-habit/{program}/{weekNumber} — 해당 주차 습관 조회
    httpApi.addRoutes({
      path: "/public/weekly-habit/{program}/{weekNumber}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("PublicWeeklyHabit", publicWeeklyHabitLambda),
      authorizer,
    });

    // POST /user/habit-tracking — 습관 체크 기록
    httpApi.addRoutes({
      path: "/user/habit-tracking",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("UserHabitTrackingPost", userHabitTrackingLambda),
      authorizer,
    });

    // GET /user/habit-tracking/{weekNumber} — 주차별 체크 기록 조회
    httpApi.addRoutes({
      path: "/user/habit-tracking/{weekNumber}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("UserHabitTrackingGet", userHabitTrackingLambda),
      authorizer,
    });

    /* ===============================
       수면 습관 관리 Lambdas (관리자 입력 → 사용자 누적 표시)
    =============================== */

    // 관리자: 수면 습관 CRUD
    const adminSleepHabitLambda = new NodejsFunction(this, "AdminSleepHabitLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-sleep-habit.ts"),
      handler: "handler",
      environment: {
        SLEEP_HABIT_TABLE_NAME: sleepHabitTable.tableName,
      },
    });

    sleepHabitTable.grantReadWriteData(adminSleepHabitLambda);

    // 사용자: 누적 수면 습관 조회
    const publicSleepHabitLambda = new NodejsFunction(this, "PublicSleepHabitLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "public-sleep-habit.ts"),
      handler: "handler",
      environment: {
        SLEEP_HABIT_TABLE_NAME: sleepHabitTable.tableName,
      },
    });

    sleepHabitTable.grantReadData(publicSleepHabitLambda);

    // 관리자용 API 엔드포인트 (인증 필요)
    // GET /admin/sleep-habit/{program} — 전체 주차 목록
    httpApi.addRoutes({
      path: "/admin/sleep-habit/{program}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("AdminSleepHabitList", adminSleepHabitLambda),
      authorizer,
    });

    // GET /admin/sleep-habit/{program}/{weekNumber} — 특정 주차 조회
    httpApi.addRoutes({
      path: "/admin/sleep-habit/{program}/{weekNumber}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("AdminSleepHabitGet", adminSleepHabitLambda),
      authorizer,
    });

    // PUT /admin/sleep-habit/{program}/{weekNumber} — 저장/수정
    httpApi.addRoutes({
      path: "/admin/sleep-habit/{program}/{weekNumber}",
      methods: [HttpMethod.PUT],
      integration: new HttpLambdaIntegration("AdminSleepHabitPut", adminSleepHabitLambda),
      authorizer,
    });

    // DELETE /admin/sleep-habit/{program}/{weekNumber} — 삭제
    httpApi.addRoutes({
      path: "/admin/sleep-habit/{program}/{weekNumber}",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("AdminSleepHabitDelete", adminSleepHabitLambda),
      authorizer,
    });

    // 사용자용 API 엔드포인트 (인증 필요)
    // GET /public/sleep-habit/{program}/{weekNumber} — 누적 수면 습관 조회
    httpApi.addRoutes({
      path: "/public/sleep-habit/{program}/{weekNumber}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("PublicSleepHabit", publicSleepHabitLambda),
      authorizer,
    });

    /* ===============================
       PSQI 수면 품질 검사 (DynamoDB + Lambda + API)
    =============================== */

    // PSQI 결과 저장 테이블
    const psqiResultsTable = new dynamodb.Table(this, "PSQIResultsTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "testDate", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // PSQI Lambda
    const userPsqiResultLambda = new NodejsFunction(this, "UserPSQIResultLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "user-psqi-result.ts"),
      handler: "handler",
      environment: {
        PSQI_RESULTS_TABLE_NAME: psqiResultsTable.tableName,
      },
    });

    psqiResultsTable.grantReadWriteData(userPsqiResultLambda);

    // POST /user/psqi-result — PSQI 결과 저장
    httpApi.addRoutes({
      path: "/user/psqi-result",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("UserPSQIResultPost", userPsqiResultLambda),
      authorizer,
    });

    // GET /user/psqi-result — PSQI 결과 조회
    httpApi.addRoutes({
      path: "/user/psqi-result",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("UserPSQIResultGet", userPsqiResultLambda),
      authorizer,
    });

    /* ===============================
       자율신경 자가 체크 (DynamoDB + Lambda + API)
    =============================== */

    // 자가 체크 결과 저장 테이블
    const selfCheckResultsTable = new dynamodb.Table(this, "SelfCheckResultsTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "testDate", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // 자가 체크 Lambda
    const userSelfCheckResultLambda = new NodejsFunction(this, "UserSelfCheckResultLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "user-selfcheck-result.ts"),
      handler: "handler",
      environment: {
        SELFCHECK_RESULTS_TABLE_NAME: selfCheckResultsTable.tableName,
      },
    });

    selfCheckResultsTable.grantReadWriteData(userSelfCheckResultLambda);

    // POST /user/selfcheck-result — 자가 체크 결과 저장
    httpApi.addRoutes({
      path: "/user/selfcheck-result",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("UserSelfCheckResultPost", userSelfCheckResultLambda),
      authorizer,
    });

    // GET /user/selfcheck-result — 자가 체크 결과 조회
    httpApi.addRoutes({
      path: "/user/selfcheck-result",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("UserSelfCheckResultGet", userSelfCheckResultLambda),
      authorizer,
    });

    /* ===============================
       선물 사이클 (GiftCycles) — Balance 선물 진행도 관리
    =============================== */

    const giftCyclesTable = new dynamodb.Table(this, "GiftCyclesTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "cycleKey", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    const userGiftCycleLambda = new NodejsFunction(this, "UserGiftCycleLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "user-gift-cycle.ts"),
      handler: "handler",
      environment: {
        GIFT_CYCLES_TABLE_NAME: giftCyclesTable.tableName,
      },
    });

    giftCyclesTable.grantReadWriteData(userGiftCycleLambda);

    // POST /user/gift-cycles — 선물 사이클 저장
    httpApi.addRoutes({
      path: "/user/gift-cycles",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("UserGiftCyclePost", userGiftCycleLambda),
      authorizer,
    });

    // GET /user/gift-cycles — 선물 사이클 조회
    httpApi.addRoutes({
      path: "/user/gift-cycles",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("UserGiftCycleGet", userGiftCycleLambda),
      authorizer,
    });

    /* ===============================
       사용자 시청 기록 (WatchRecords) — Balance 영상 시청 기록 저장/조회
    =============================== */

    const userWatchRecordLambda = new NodejsFunction(this, "UserWatchRecordLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "user-watch-record.ts"),
      handler: "handler",
      environment: {
        WATCH_RECORDS_TABLE_NAME: watchRecordsTable.tableName,
      },
    });

    watchRecordsTable.grantReadWriteData(userWatchRecordLambda);

    // POST /user/watch-records — 시청 기록 저장
    httpApi.addRoutes({
      path: "/user/watch-records",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("UserWatchRecordPost", userWatchRecordLambda),
      authorizer,
    });

    // GET /user/watch-records — 시청 기록 조회
    httpApi.addRoutes({
      path: "/user/watch-records",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("UserWatchRecordGet", userWatchRecordLambda),
      authorizer,
    });

    /* ===============================
       실천 기록 (PracticeRecords) — 솔루션/해빗/이해의바다
    =============================== */

    const practiceRecordsTable = new dynamodb.Table(this, "PracticeRecordsTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "recordKey", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    const userPracticeRecordLambda = new NodejsFunction(this, "UserPracticeRecordLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "user-practice-record.ts"),
      handler: "handler",
      environment: {
        PRACTICE_RECORDS_TABLE_NAME: practiceRecordsTable.tableName,
      },
    });

    practiceRecordsTable.grantReadWriteData(userPracticeRecordLambda);

    // POST /user/practice-record — 실천 기록 저장
    httpApi.addRoutes({
      path: "/user/practice-record",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("UserPracticeRecordPost", userPracticeRecordLambda),
      authorizer,
    });

    // GET /user/practice-record — 실천 기록 조회
    httpApi.addRoutes({
      path: "/user/practice-record",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("UserPracticeRecordGet", userPracticeRecordLambda),
      authorizer,
    });

    /* ===============================
       수면 기록 + 습관 체크 (DynamoDB + Lambda + API)
    =============================== */

    // 수면 기록 테이블
    const userSleepLogTable = new dynamodb.Table(this, "UserSleepLogTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "logKey", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // 수면 기록 Lambda
    const userSleepLogLambda = new NodejsFunction(this, "UserSleepLogLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "user-sleep-log.ts"),
      handler: "handler",
      environment: {
        USER_SLEEP_LOG_TABLE_NAME: userSleepLogTable.tableName,
      },
    });

    userSleepLogTable.grantReadWriteData(userSleepLogLambda);

    // POST /user/sleep-log — 수면 기록 저장
    httpApi.addRoutes({
      path: "/user/sleep-log",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("UserSleepLogPost", userSleepLogLambda),
      authorizer,
    });

    // GET /user/sleep-log — 수면 기록 조회
    httpApi.addRoutes({
      path: "/user/sleep-log",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("UserSleepLogGet", userSleepLogLambda),
      authorizer,
    });

    // POST /user/sleep-log/config — 습관 설정 저장
    httpApi.addRoutes({
      path: "/user/sleep-log/config",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("UserSleepLogConfigPost", userSleepLogLambda),
      authorizer,
    });

    // GET /user/sleep-log/config — 습관 설정 조회
    httpApi.addRoutes({
      path: "/user/sleep-log/config",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("UserSleepLogConfigGet", userSleepLogLambda),
      authorizer,
    });

    /* ===============================
       사용자 환경설정 (프로그램 선택, 시작일 등)
    =============================== */

    // 환경설정 테이블
    const userPreferencesTable = new dynamodb.Table(this, "UserPreferencesTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // 환경설정 Lambda
    const userPreferencesLambda = new NodejsFunction(this, "UserPreferencesLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "user-preferences.ts"),
      handler: "handler",
      environment: {
        USER_PREFERENCES_TABLE_NAME: userPreferencesTable.tableName,
      },
    });

    userPreferencesTable.grantReadWriteData(userPreferencesLambda);

    // 관리자 회원 상세 조회에서 솔루션 선택 정보 표시
    getUserLambda.addEnvironment("USER_PREFERENCES_TABLE_NAME", userPreferencesTable.tableName);
    userPreferencesTable.grantReadData(getUserLambda);

    // GET /user/preferences — 환경설정 조회
    httpApi.addRoutes({
      path: "/user/preferences",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("UserPreferencesGet", userPreferencesLambda),
      authorizer,
    });

    // PUT /user/preferences — 환경설정 저장
    httpApi.addRoutes({
      path: "/user/preferences",
      methods: [HttpMethod.PUT],
      integration: new HttpLambdaIntegration("UserPreferencesPut", userPreferencesLambda),
      authorizer,
    });

    /* ===============================
       관리자 회원 삭제 (Cognito 삭제 + DynamoDB 익명화)
    =============================== */
    const adminDeleteUserLambda = new NodejsFunction(this, "AdminDeleteUserLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-delete-user.ts"),
      handler: "handler",
      timeout: cdk.Duration.minutes(5),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USERS_TABLE_NAME: usersTable.tableName,
        SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
        PAYMENTS_TABLE_NAME: paymentsTable.tableName,
        WATCH_RECORDS_TABLE_NAME: watchRecordsTable.tableName,
        USER_HABIT_TRACKING_TABLE_NAME: userHabitTrackingTable.tableName,
        PSQI_RESULTS_TABLE_NAME: psqiResultsTable.tableName,
        SELFCHECK_RESULTS_TABLE_NAME: selfCheckResultsTable.tableName,
        USER_SLEEP_LOG_TABLE_NAME: userSleepLogTable.tableName,
        PRACTICE_RECORDS_TABLE_NAME: practiceRecordsTable.tableName,
        USER_PREFERENCES_TABLE_NAME: userPreferencesTable.tableName,
        GIFT_CYCLES_TABLE_NAME: giftCyclesTable.tableName,
      },
    });

    usersTable.grantReadWriteData(adminDeleteUserLambda);
    subscriptionsTable.grantReadWriteData(adminDeleteUserLambda);
    paymentsTable.grantReadWriteData(adminDeleteUserLambda);
    userPreferencesTable.grantReadWriteData(adminDeleteUserLambda);
    watchRecordsTable.grantReadWriteData(adminDeleteUserLambda);
    userHabitTrackingTable.grantReadWriteData(adminDeleteUserLambda);
    psqiResultsTable.grantReadWriteData(adminDeleteUserLambda);
    selfCheckResultsTable.grantReadWriteData(adminDeleteUserLambda);
    userSleepLogTable.grantReadWriteData(adminDeleteUserLambda);
    practiceRecordsTable.grantReadWriteData(adminDeleteUserLambda);
    giftCyclesTable.grantReadWriteData(adminDeleteUserLambda);

    adminDeleteUserLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ["cognito-idp:AdminDeleteUser"],
      resources: [userPool.userPoolArn],
    }));

    // DELETE /admin/users/{userId} — 관리자 회원 삭제
    httpApi.addRoutes({
      path: "/admin/users/{userId}",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("AdminDeleteUser", adminDeleteUserLambda),
      authorizer,
    });

    /* ===============================
       사용자 구독 상태 (결제/무료 체험 기반)
    =============================== */

    const userSubscriptionLambda = new NodejsFunction(this, "UserSubscriptionLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "user-subscription.ts"),
      handler: "handler",
      environment: {
        SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
      },
    });

    subscriptionsTable.grantReadWriteData(userSubscriptionLambda);

    // GET /user/subscription?programId=autobalance — 구독 조회
    httpApi.addRoutes({
      path: "/user/subscription",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("UserSubscriptionGet", userSubscriptionLambda),
      authorizer,
    });

    // PUT /user/subscription — 구독 저장/갱신
    httpApi.addRoutes({
      path: "/user/subscription",
      methods: [HttpMethod.PUT],
      integration: new HttpLambdaIntegration("UserSubscriptionPut", userSubscriptionLambda),
      authorizer,
    });

    /* ===============================
       결제 (토스 페이먼츠 빌링키)
    =============================== */

    // 빌링키 발급 Lambda
    const billingIssueKeyLambda = new NodejsFunction(this, "BillingIssueKeyLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "billing-issue-key.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(30),
      environment: {
        PAYMENTS_TABLE_NAME: paymentsTable.tableName,
        SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
        TOSS_SECRET_KEY: process.env.TOSS_SECRET_KEY || "test_sk_placeholder",
      },
    });

    paymentsTable.grantReadWriteData(billingIssueKeyLambda);
    subscriptionsTable.grantReadWriteData(billingIssueKeyLambda);

    // 결제 수단 변경 (빌링키 교체) Lambda — PaymentsTable만 업데이트, 구독 상태 미변경
    const billingUpdateKeyLambda = new NodejsFunction(this, "BillingUpdateKeyLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "billing-update-key.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(30),
      environment: {
        PAYMENTS_TABLE_NAME: paymentsTable.tableName,
        TOSS_SECRET_KEY: process.env.TOSS_SECRET_KEY || "test_sk_placeholder",
      },
    });

    paymentsTable.grantReadWriteData(billingUpdateKeyLambda);

    // 자동 결제 실행 Lambda
    const billingChargeLambda = new NodejsFunction(this, "BillingChargeLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "billing-charge.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(30),
      environment: {
        PAYMENTS_TABLE_NAME: paymentsTable.tableName,
        SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
        TOSS_SECRET_KEY: process.env.TOSS_SECRET_KEY || "test_sk_placeholder",
      },
    });

    paymentsTable.grantReadWriteData(billingChargeLambda);
    subscriptionsTable.grantReadWriteData(billingChargeLambda);

    // 구독 해지 Lambda
    const billingCancelLambda = new NodejsFunction(this, "BillingCancelLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "billing-cancel.ts"),
      handler: "handler",
      environment: {
        PAYMENTS_TABLE_NAME: paymentsTable.tableName,
        SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
      },
    });

    paymentsTable.grantReadWriteData(billingCancelLambda);
    subscriptionsTable.grantReadWriteData(billingCancelLambda);

    // 자동 결제 스케줄러 Lambda
    const billingChargeSchedulerLambda = new NodejsFunction(this, "BillingChargeSchedulerLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "billing-charge-scheduler.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(60),
      environment: {
        SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
        PAYMENTS_TABLE_NAME: paymentsTable.tableName,
        BILLING_CHARGE_FUNCTION_NAME: billingChargeLambda.functionName,
      },
    });

    subscriptionsTable.grantReadData(billingChargeSchedulerLambda);
    paymentsTable.grantReadData(billingChargeSchedulerLambda);
    billingChargeLambda.grantInvoke(billingChargeSchedulerLambda);

    // EventBridge: 매일 00:00 KST (15:00 UTC) 자동 결제 스케줄
    new events.Rule(this, "TrialExpiryChargeRule", {
      schedule: events.Schedule.cron({ minute: "0", hour: "15" }),
      targets: [new targets.LambdaFunction(billingChargeSchedulerLambda)],
    });

    /* ===============================
       회원 탈퇴 Lambdas
    =============================== */

    // 탈퇴 요청 Lambda (비밀번호 검증 + Cognito 비활성화 + DB 상태 갱신)
    const userWithdrawLambda = new NodejsFunction(this, "UserWithdrawLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "user-withdraw.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(30),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        USERS_TABLE_NAME: usersTable.tableName,
        SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
      },
    });

    usersTable.grantReadWriteData(userWithdrawLambda);
    subscriptionsTable.grantReadData(userWithdrawLambda);

    const cognitoWithdrawPolicy = new iam.PolicyStatement({
      actions: [
        "cognito-idp:AdminInitiateAuth",
        "cognito-idp:AdminDisableUser",
      ],
      resources: [userPool.userPoolArn],
    });
    userWithdrawLambda.addToRolePolicy(cognitoWithdrawPolicy);

    // 30일 만료 익명화 스케줄러 Lambda
    const accountCleanupSchedulerLambda = new NodejsFunction(this, "AccountCleanupSchedulerLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "account-cleanup-scheduler.ts"),
      handler: "handler",
      timeout: cdk.Duration.minutes(15),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USERS_TABLE_NAME: usersTable.tableName,
        SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
        PAYMENTS_TABLE_NAME: paymentsTable.tableName,
        WATCH_RECORDS_TABLE_NAME: watchRecordsTable.tableName,
        USER_HABIT_TRACKING_TABLE_NAME: userHabitTrackingTable.tableName,
        PSQI_RESULTS_TABLE_NAME: psqiResultsTable.tableName,
        SELFCHECK_RESULTS_TABLE_NAME: selfCheckResultsTable.tableName,
        USER_SLEEP_LOG_TABLE_NAME: userSleepLogTable.tableName,
        PRACTICE_RECORDS_TABLE_NAME: practiceRecordsTable.tableName,
        USER_PREFERENCES_TABLE_NAME: userPreferencesTable.tableName,
        GIFT_CYCLES_TABLE_NAME: giftCyclesTable.tableName,
      },
    });

    usersTable.grantReadWriteData(accountCleanupSchedulerLambda);
    subscriptionsTable.grantReadWriteData(accountCleanupSchedulerLambda);
    paymentsTable.grantReadWriteData(accountCleanupSchedulerLambda);
    watchRecordsTable.grantReadWriteData(accountCleanupSchedulerLambda);
    userHabitTrackingTable.grantReadWriteData(accountCleanupSchedulerLambda);
    psqiResultsTable.grantReadWriteData(accountCleanupSchedulerLambda);
    selfCheckResultsTable.grantReadWriteData(accountCleanupSchedulerLambda);
    userSleepLogTable.grantReadWriteData(accountCleanupSchedulerLambda);
    practiceRecordsTable.grantReadWriteData(accountCleanupSchedulerLambda);
    userPreferencesTable.grantReadWriteData(accountCleanupSchedulerLambda);
    giftCyclesTable.grantReadWriteData(accountCleanupSchedulerLambda);

    const cognitoDeletePolicy = new iam.PolicyStatement({
      actions: ["cognito-idp:AdminDeleteUser"],
      resources: [userPool.userPoolArn],
    });
    accountCleanupSchedulerLambda.addToRolePolicy(cognitoDeletePolicy);

    // EventBridge: 매일 01:00 KST (16:00 UTC) 탈퇴 만료 체크
    new events.Rule(this, "AccountCleanupRule", {
      schedule: events.Schedule.cron({ minute: "0", hour: "16" }),
      targets: [new targets.LambdaFunction(accountCleanupSchedulerLambda)],
    });

    // POST /user/withdraw — 회원 탈퇴 요청
    httpApi.addRoutes({
      path: "/user/withdraw",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("UserWithdraw", userWithdrawLambda),
      authorizer,
    });

    // API Gateway: 결제 엔드포인트
    // POST /user/billing/issue-key — 빌링키 발급
    httpApi.addRoutes({
      path: "/user/billing/issue-key",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("BillingIssueKey", billingIssueKeyLambda),
      authorizer,
    });

    // POST /user/billing/update-key — 결제 수단 변경 (빌링키 교체)
    httpApi.addRoutes({
      path: "/user/billing/update-key",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("BillingUpdateKey", billingUpdateKeyLambda),
      authorizer,
    });

    // POST /user/billing/cancel — 구독 해지
    httpApi.addRoutes({
      path: "/user/billing/cancel",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("BillingCancel", billingCancelLambda),
      authorizer,
    });

    // 결제 정보 조회 Lambda
    const billingInfoLambda = new NodejsFunction(this, "BillingInfoLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "billing-info.ts"),
      handler: "handler",
      environment: {
        PAYMENTS_TABLE_NAME: paymentsTable.tableName,
      },
    });

    paymentsTable.grantReadData(billingInfoLambda);

    // GET /user/billing/info — 결제 정보 조회
    httpApi.addRoutes({
      path: "/user/billing/info",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("BillingInfo", billingInfoLambda),
      authorizer,
    });

    /* ===============================
       사용자 프로필 (온보딩 데이터 저장)
    =============================== */

    const userProfileLambda = new NodejsFunction(this, "UserProfileLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "user-profile.ts"),
      handler: "handler",
      environment: {
        USERS_TABLE_NAME: usersTable.tableName,
      },
    });

    usersTable.grantReadWriteData(userProfileLambda);

    // PUT /user/profile — 프로필 저장
    httpApi.addRoutes({
      path: "/user/profile",
      methods: [HttpMethod.PUT],
      integration: new HttpLambdaIntegration("UserProfilePut", userProfileLambda),
      authorizer,
    });

    // GET /user/profile — 프로필 조회
    httpApi.addRoutes({
      path: "/user/profile",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("UserProfileGet", userProfileLambda),
      authorizer,
    });

    // POST /user/record-login — 로그인 시각 기록
    httpApi.addRoutes({
      path: "/user/record-login",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("UserRecordLogin", userProfileLambda),
      authorizer,
    });

    /* ===============================
       프로필 복구 Lambda (일회성)
       손상된 프로필(wellnessGoal=null)을 다른 테이블에서 복원
    =============================== */

    const repairProfilesLambda = new NodejsFunction(this, "RepairProfilesLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "repair-profiles.ts"),
      handler: "handler",
      timeout: cdk.Duration.minutes(5),
      environment: {
        USERS_TABLE_NAME: usersTable.tableName,
        SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
        WATCH_RECORDS_TABLE_NAME: watchRecordsTable.tableName,
        USER_PREFERENCES_TABLE_NAME: userPreferencesTable.tableName,
      },
    });

    usersTable.grantReadWriteData(repairProfilesLambda);
    subscriptionsTable.grantReadData(repairProfilesLambda);
    watchRecordsTable.grantReadData(repairProfilesLambda);
    userPreferencesTable.grantReadData(repairProfilesLambda);

    // 관리자 API로 복구 실행 (POST /admin/repair-profiles)
    httpApi.addRoutes({
      path: "/admin/repair-profiles",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("RepairProfiles", repairProfilesLambda),
      authorizer,
    });

    /* ===============================
       관리자 대시보드 통계
    =============================== */

    const adminDashboardStatsLambda = new NodejsFunction(this, "AdminDashboardStatsLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "admin-dashboard-stats.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(30),
      environment: {
        USERS_TABLE_NAME: usersTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
    });

    usersTable.grantReadData(adminDashboardStatsLambda);
    adminDashboardStatsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:ListUsers"],
        resources: [userPool.userPoolArn],
      })
    );

    // GET /admin/dashboard-stats — 대시보드 통계
    httpApi.addRoutes({
      path: "/admin/dashboard-stats",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("AdminDashboardStats", adminDashboardStatsLambda),
      authorizer,
    });

    /* ===============================
       ✅ AWS Backup — DynamoDB 장기 보존 자동 백업
    =============================== */

    // 백업 저장소 (Vault)
    const backupVault = new backup.BackupVault(this, "HealechoBackupVault", {
      backupVaultName: "healecho-backup-vault",
      removalPolicy: cdk.RemovalPolicy.RETAIN,    // 스택 삭제 시에도 백업 데이터 보존
    });

    // 백업 플랜: 주간 + 월간 자동 백업
    const backupPlan = new backup.BackupPlan(this, "HealechoBackupPlan", {
      backupPlanName: "healecho-dynamodb-backup",
      backupPlanRules: [
        // 주간 백업: 매주 일요일 03:00 KST (토요일 18:00 UTC), 30일 보존
        new backup.BackupPlanRule({
          ruleName: "WeeklyBackup",
          scheduleExpression: events.Schedule.cron({
            minute: "0",
            hour: "18",
            weekDay: "SAT",
          }),
          deleteAfter: cdk.Duration.days(30),
          backupVault,
        }),
        // 월간 백업: 매월 1일 03:00 KST (전월 말일 18:00 UTC), 365일 보존
        new backup.BackupPlanRule({
          ruleName: "MonthlyBackup",
          scheduleExpression: events.Schedule.cron({
            minute: "0",
            hour: "18",
            day: "1",
          }),
          deleteAfter: cdk.Duration.days(365),
          backupVault,
        }),
      ],
    });

    // 핵심 테이블 백업 대상 등록
    const criticalTables = [
      usersTable,
      subscriptionsTable,
      paymentsTable,
      watchRecordsTable,
      giftCyclesTable,
      psqiResultsTable,
      selfCheckResultsTable,
      userHabitTrackingTable,
      userSleepLogTable,
      practiceRecordsTable,
      userPreferencesTable,
      balanceVideosTable,
      weeklyHabitContentTable,
      sleepHabitTable,
      itemsTable,
    ];

    for (const table of criticalTables) {
      backupPlan.addSelection(`Backup-${table.node.id}`, {
        resources: [backup.BackupResource.fromDynamoDbTable(table)],
      });
    }

    /* ===============================
       ✅ Cognito 사용자 백업 Lambda — 매일 자동 Export
    =============================== */

    const cognitoBackupLambda = new NodejsFunction(this, "CognitoBackupLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "..", "lambda", "cognito-backup.ts"),
      handler: "handler",
      timeout: cdk.Duration.minutes(5),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        BACKUP_BUCKET: videoBucket.bucketName,
        BACKUP_PREFIX: "backups/cognito/",
      },
    });

    // Cognito 사용자 목록 읽기 권한
    cognitoBackupLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        "cognito-idp:ListUsers",
        "cognito-idp:AdminGetUser",
      ],
      resources: [userPool.userPoolArn],
    }));

    // S3에 백업 파일 쓰기 권한
    videoBucket.grantWrite(cognitoBackupLambda);

    // EventBridge: 매일 02:00 KST (17:00 UTC) Cognito 백업 실행
    new events.Rule(this, "CognitoBackupRule", {
      schedule: events.Schedule.cron({ minute: "0", hour: "17" }),
      targets: [new targets.LambdaFunction(cognitoBackupLambda)],
    });

    /* ===============================
       비용 알림 (AWS Budgets → 이메일 직접 전송)
       SNS 구독 확인 불필요 — Budgets가 직접 이메일 발송
    =============================== */

    // 알림 받을 이메일: cdk deploy 시 BUDGET_ALERT_EMAIL 환경변수로 전달
    // 예: BUDGET_ALERT_EMAIL=you@example.com npx cdk deploy
    const alertEmail = process.env.BUDGET_ALERT_EMAIL || "";

    if (alertEmail) {
      // 월 $300 예산 + 80%, 100%, 120% 알림
      new budgets.CfnBudget(this, "MonthlyBudget", {
        budget: {
          budgetName: "healecho-monthly-budget",
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: {
            amount: 300,
            unit: "USD",
          },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              comparisonOperator: "GREATER_THAN",
              threshold: 80,
              thresholdType: "PERCENTAGE",
              notificationType: "ACTUAL",
            },
            subscribers: [
              { subscriptionType: "EMAIL", address: alertEmail },
            ],
          },
          {
            notification: {
              comparisonOperator: "GREATER_THAN",
              threshold: 100,
              thresholdType: "PERCENTAGE",
              notificationType: "ACTUAL",
            },
            subscribers: [
              { subscriptionType: "EMAIL", address: alertEmail },
            ],
          },
          {
            notification: {
              comparisonOperator: "GREATER_THAN",
              threshold: 120,
              thresholdType: "PERCENTAGE",
              notificationType: "ACTUAL",
            },
            subscribers: [
              { subscriptionType: "EMAIL", address: alertEmail },
            ],
          },
        ],
      });
    }

    /* ===============================
       Outputs
    =============================== */
    new cdk.CfnOutput(this, "HttpApiUrl", {
      value: httpApi.apiEndpoint,
    });

    new cdk.CfnOutput(this, "CognitoDomainUrl", {
      value: "https://healecho-admin.auth.ap-northeast-2.amazoncognito.com",
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
  }
}
