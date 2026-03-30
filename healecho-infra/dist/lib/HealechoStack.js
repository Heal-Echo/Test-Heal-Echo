"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealechoStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const aws_cdk_lib_1 = require("aws-cdk-lib");
const path = __importStar(require("path"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const aws_apigatewayv2_alpha_1 = require("@aws-cdk/aws-apigatewayv2-alpha");
const aws_apigatewayv2_integrations_alpha_1 = require("@aws-cdk/aws-apigatewayv2-integrations-alpha");
const aws_apigatewayv2_authorizers_alpha_1 = require("@aws-cdk/aws-apigatewayv2-authorizers-alpha");
class HealechoStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        /* ===============================
           S3 Buckets
        =============================== */
        const siteBucket = new aws_cdk_lib_1.aws_s3.Bucket(this, "SiteBucket", {
            blockPublicAccess: aws_cdk_lib_1.aws_s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        const videoBucket = new aws_cdk_lib_1.aws_s3.Bucket(this, "VideoBucket", {
            blockPublicAccess: aws_cdk_lib_1.aws_s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            cors: [
                {
                    allowedMethods: [aws_cdk_lib_1.aws_s3.HttpMethods.GET, aws_cdk_lib_1.aws_s3.HttpMethods.PUT],
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
        const oai = new aws_cdk_lib_1.aws_cloudfront.OriginAccessIdentity(this, "OAI");
        siteBucket.addToResourcePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ["s3:GetObject"],
            resources: [`${siteBucket.bucketArn}/*`],
            principals: [
                new aws_cdk_lib_1.aws_iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId),
            ],
        }));
        videoBucket.addToResourcePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ["s3:GetObject"],
            resources: [`${videoBucket.bucketArn}/*`],
            principals: [
                new aws_cdk_lib_1.aws_iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId),
            ],
        }));
        const videoOrigin = new aws_cdk_lib_1.aws_cloudfront_origins.S3Origin(videoBucket, {
            originAccessIdentity: oai,
        });
        new aws_cdk_lib_1.aws_cloudfront.Distribution(this, "WebDistribution", {
            defaultRootObject: "index.html",
            defaultBehavior: {
                origin: new aws_cdk_lib_1.aws_cloudfront_origins.S3Origin(siteBucket, {
                    originAccessIdentity: oai,
                }),
                viewerProtocolPolicy: aws_cdk_lib_1.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: aws_cdk_lib_1.aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            additionalBehaviors: {
                "videos/*": {
                    origin: videoOrigin,
                    viewerProtocolPolicy: aws_cdk_lib_1.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: aws_cdk_lib_1.aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    cachePolicy: aws_cdk_lib_1.aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
                },
                "uploads/*": {
                    origin: videoOrigin,
                    viewerProtocolPolicy: aws_cdk_lib_1.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: aws_cdk_lib_1.aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    cachePolicy: aws_cdk_lib_1.aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
                },
                "thumbnails/*": {
                    origin: videoOrigin,
                    viewerProtocolPolicy: aws_cdk_lib_1.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: aws_cdk_lib_1.aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    cachePolicy: aws_cdk_lib_1.aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
                },
                /* ── 위클리 해빗 영상 경로 (Phase 1-4) ── */
                "weekly-habit/*": {
                    origin: videoOrigin,
                    viewerProtocolPolicy: aws_cdk_lib_1.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: aws_cdk_lib_1.aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    cachePolicy: aws_cdk_lib_1.aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
                },
            },
        });
        /* ===============================
           DynamoDB
        =============================== */
        const itemsTable = new aws_cdk_lib_1.aws_dynamodb.Table(this, "ItemsTable", {
            partitionKey: { name: "id", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            billingMode: aws_cdk_lib_1.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const balanceVideosTable = new aws_cdk_lib_1.aws_dynamodb.Table(this, "BalanceVideosTable", {
            partitionKey: { name: "program", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            sortKey: { name: "weekNumber", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.NUMBER },
            billingMode: aws_cdk_lib_1.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        /* ── 회원 관리 테이블 ── */
        const usersTable = new aws_cdk_lib_1.aws_dynamodb.Table(this, "UsersTable", {
            partitionKey: { name: "userId", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            billingMode: aws_cdk_lib_1.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // 이메일로 회원 검색용 GSI
        usersTable.addGlobalSecondaryIndex({
            indexName: "email-index",
            partitionKey: { name: "email", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
        });
        // 고객 유형별 필터 + 가입일순 정렬용 GSI
        usersTable.addGlobalSecondaryIndex({
            indexName: "type-createdAt-index",
            partitionKey: { name: "subscriptionType", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            sortKey: { name: "createdAt", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
        });
        const watchRecordsTable = new aws_cdk_lib_1.aws_dynamodb.Table(this, "WatchRecordsTable", {
            partitionKey: { name: "userId", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            sortKey: { name: "watchDate", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            billingMode: aws_cdk_lib_1.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        /* ── 위클리 해빗 테이블 (Phase 1-1) ── */
        const weeklyHabitContentTable = new aws_cdk_lib_1.aws_dynamodb.Table(this, "WeeklyHabitContentTable", {
            partitionKey: { name: "program", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            sortKey: { name: "weekNumber", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.NUMBER },
            billingMode: aws_cdk_lib_1.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const userHabitTrackingTable = new aws_cdk_lib_1.aws_dynamodb.Table(this, "UserHabitTrackingTable", {
            partitionKey: { name: "userId", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            sortKey: { name: "trackingKey", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            billingMode: aws_cdk_lib_1.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        /* ── 수면 습관 테이블 (관리자 → 사용자 누적 표시) ── */
        const sleepHabitTable = new aws_cdk_lib_1.aws_dynamodb.Table(this, "SleepHabitTable", {
            partitionKey: { name: "program", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            sortKey: { name: "weekNumber", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.NUMBER },
            billingMode: aws_cdk_lib_1.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        /* ===============================
           Cognito
        =============================== */
        const userPool = new aws_cdk_lib_1.aws_cognito.UserPool(this, "UserPool", {
            selfSignUpEnabled: true,
            signInAliases: { email: true },
        });
        // 하이브리드 소셜 로그인: 직접 카카오 OAuth → 서버에서 Cognito Admin API로 사용자 생성/인증
        // (Cognito OIDC Federation은 이메일 필수 제약으로 사용 불가)
        const userPoolClient = new aws_cdk_lib_1.aws_cognito.UserPoolClient(this, "UserPoolClient", {
            userPool,
            generateSecret: false,
            authFlows: {
                userSrp: true,
                userPassword: true,
                adminUserPassword: true, // 서버에서 AdminInitiateAuth 사용
            },
        });
        const authorizer = new aws_apigatewayv2_authorizers_alpha_1.HttpUserPoolAuthorizer("HealechoAuthorizer", userPool, { userPoolClients: [userPoolClient] });
        /* ===============================
           HTTP API
        =============================== */
        const httpApi = new aws_apigatewayv2_alpha_1.HttpApi(this, "HealechoHttpApi", {
            apiName: "HealechoHttpApi",
            corsPreflight: {
                allowOrigins: ["*"],
                allowMethods: [
                    aws_apigatewayv2_alpha_1.CorsHttpMethod.GET,
                    aws_apigatewayv2_alpha_1.CorsHttpMethod.POST,
                    aws_apigatewayv2_alpha_1.CorsHttpMethod.PUT,
                    aws_apigatewayv2_alpha_1.CorsHttpMethod.PATCH,
                    aws_apigatewayv2_alpha_1.CorsHttpMethod.DELETE,
                    aws_apigatewayv2_alpha_1.CorsHttpMethod.OPTIONS,
                ],
                allowHeaders: ["*"],
            },
        });
        /* ===============================
           Multipart Lambdas (그대로 유지)
        =============================== */
        const mpInitiateLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "AdminBalanceMultipartInitiateLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-balance-multipart-initiate.ts"),
            handler: "handler",
            environment: { UPLOAD_BUCKET: videoBucket.bucketName },
        });
        const mpPartLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "AdminBalanceMultipartPartLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-balance-multipart-part.ts"),
            handler: "handler",
            environment: { UPLOAD_BUCKET: videoBucket.bucketName },
        });
        const mpCompleteLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "AdminBalanceMultipartCompleteLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-balance-multipart-complete.ts"),
            handler: "handler",
            environment: { UPLOAD_BUCKET: videoBucket.bucketName },
        });
        videoBucket.grantReadWrite(mpInitiateLambda);
        videoBucket.grantReadWrite(mpPartLambda);
        videoBucket.grantReadWrite(mpCompleteLambda);
        httpApi.addRoutes({
            path: "/balance/videos/{program}/{weekNumber}/multipart/initiate",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("MpInit", mpInitiateLambda),
            authorizer,
        });
        httpApi.addRoutes({
            path: "/balance/videos/{program}/{weekNumber}/multipart/part",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("MpPart", mpPartLambda),
            authorizer,
        });
        httpApi.addRoutes({
            path: "/balance/videos/{program}/{weekNumber}/multipart/complete",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("MpComplete", mpCompleteLambda),
            authorizer,
        });
        /* ===============================
           Balance 목록 조회 (관리자)
        =============================== */
        const balanceListLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "AdminBalanceListVideosLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-balance-list-videos.ts"),
            handler: "handler",
            environment: { BALANCE_TABLE_NAME: balanceVideosTable.tableName },
        });
        balanceVideosTable.grantReadData(balanceListLambda);
        httpApi.addRoutes({
            path: "/balance/videos/{program}",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("BalanceList", balanceListLambda),
            authorizer,
        });
        /* ===============================
           ✅ Balance 업로드 완료 (DB 저장)
           🔥 여기만 authorizer 제거
        =============================== */
        const balanceCompleteLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "AdminBalanceCompleteUploadLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-balance-complete-upload.ts"),
            handler: "handler",
            environment: {
                BALANCE_VIDEOS_TABLE_NAME: balanceVideosTable.tableName,
            },
        });
        balanceVideosTable.grantWriteData(balanceCompleteLambda);
        httpApi.addRoutes({
            path: "/balance/videos/{program}/{weekNumber}/complete",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("BalanceCompleteUploadIntegration", balanceCompleteLambda),
            // ✅ authorizer intentionally removed
        });
        /* ===============================
           회원 관리 Lambdas
        =============================== */
        const listUsersLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "AdminListUsersLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-list-users.ts"),
            handler: "handler",
            environment: {
                USERS_TABLE_NAME: usersTable.tableName,
                USER_POOL_ID: userPool.userPoolId,
            },
        });
        const getUserLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "AdminGetUserLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-get-user.ts"),
            handler: "handler",
            environment: {
                USERS_TABLE_NAME: usersTable.tableName,
                WATCH_RECORDS_TABLE_NAME: watchRecordsTable.tableName,
                USER_POOL_ID: userPool.userPoolId,
            },
        });
        const updateUserLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "AdminUpdateUserLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-update-user.ts"),
            handler: "handler",
            environment: { USERS_TABLE_NAME: usersTable.tableName },
        });
        const getUserWatchRecordsLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "AdminGetUserWatchRecordsLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-get-user-watch-records.ts"),
            handler: "handler",
            environment: { WATCH_RECORDS_TABLE_NAME: watchRecordsTable.tableName },
        });
        // DynamoDB 권한 부여
        usersTable.grantReadData(listUsersLambda);
        usersTable.grantReadData(getUserLambda);
        usersTable.grantReadWriteData(updateUserLambda);
        watchRecordsTable.grantReadData(getUserLambda);
        watchRecordsTable.grantReadData(getUserWatchRecordsLambda);
        // Cognito 읽기 권한 (회원 목록/상세 조회용)
        const cognitoReadPolicy = new aws_cdk_lib_1.aws_iam.PolicyStatement({
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
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("ListUsers", listUsersLambda),
            authorizer,
        });
        httpApi.addRoutes({
            path: "/admin/users/{userId}",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("GetUser", getUserLambda),
            authorizer,
        });
        httpApi.addRoutes({
            path: "/admin/users/{userId}",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.PATCH],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UpdateUser", updateUserLambda),
            authorizer,
        });
        httpApi.addRoutes({
            path: "/admin/users/{userId}/watch-records",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("GetUserWatchRecords", getUserWatchRecordsLambda),
            authorizer,
        });
        /* ===============================
           Public Landing 영상 조회
        =============================== */
        const publicVideosLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "PublicGetVideosLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "public-get-videos.ts"),
            handler: "handler",
            environment: { ITEMS_TABLE_NAME: itemsTable.tableName },
        });
        itemsTable.grantReadData(publicVideosLambda);
        httpApi.addRoutes({
            path: "/public/videos",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("PublicVideos", publicVideosLambda),
        });
        /* ===============================
           위클리 해빗 Lambdas (Phase 1-2, 1-3)
        =============================== */
        // 관리자: 주차별 습관 콘텐츠 CRUD
        const adminWeeklyHabitLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "AdminWeeklyHabitContentLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-weekly-habit-content.ts"),
            handler: "handler",
            environment: {
                WEEKLY_HABIT_CONTENT_TABLE_NAME: weeklyHabitContentTable.tableName,
            },
        });
        weeklyHabitContentTable.grantReadWriteData(adminWeeklyHabitLambda);
        // 사용자: 주차별 습관 콘텐츠 조회
        const publicWeeklyHabitLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "PublicWeeklyHabitContentLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "public-weekly-habit-content.ts"),
            handler: "handler",
            environment: {
                WEEKLY_HABIT_CONTENT_TABLE_NAME: weeklyHabitContentTable.tableName,
            },
        });
        weeklyHabitContentTable.grantReadData(publicWeeklyHabitLambda);
        // 사용자: 습관 체크 기록/조회
        const userHabitTrackingLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "UserHabitTrackingLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "user-habit-tracking.ts"),
            handler: "handler",
            environment: {
                USER_HABIT_TRACKING_TABLE_NAME: userHabitTrackingTable.tableName,
            },
        });
        userHabitTrackingTable.grantReadWriteData(userHabitTrackingLambda);
        /* ── 위클리 해빗 Multipart 업로드 Lambda ── */
        const weeklyHabitMpInitiateLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "WeeklyHabitMultipartInitiateLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-balance-multipart-initiate.ts"),
            handler: "handler",
            environment: { UPLOAD_BUCKET: videoBucket.bucketName },
        });
        const weeklyHabitMpPartLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "WeeklyHabitMultipartPartLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-balance-multipart-part.ts"),
            handler: "handler",
            environment: { UPLOAD_BUCKET: videoBucket.bucketName },
        });
        const weeklyHabitMpCompleteLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "WeeklyHabitMultipartCompleteLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
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
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("AdminWeeklyHabitList", adminWeeklyHabitLambda),
            authorizer,
        });
        // POST /admin/weekly-habit/{program}/{weekNumber} — 콘텐츠 등록
        httpApi.addRoutes({
            path: "/admin/weekly-habit/{program}/{weekNumber}",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("AdminWeeklyHabitCreate", adminWeeklyHabitLambda),
            authorizer,
        });
        // GET /admin/weekly-habit/{program}/{weekNumber} — 특정 주차 조회
        httpApi.addRoutes({
            path: "/admin/weekly-habit/{program}/{weekNumber}",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("AdminWeeklyHabitGet", adminWeeklyHabitLambda),
            authorizer,
        });
        // PUT /admin/weekly-habit/{program}/{weekNumber} — 수정
        httpApi.addRoutes({
            path: "/admin/weekly-habit/{program}/{weekNumber}",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.PUT],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("AdminWeeklyHabitUpdate", adminWeeklyHabitLambda),
            authorizer,
        });
        // DELETE /admin/weekly-habit/{program}/{weekNumber} — 삭제
        httpApi.addRoutes({
            path: "/admin/weekly-habit/{program}/{weekNumber}",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.DELETE],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("AdminWeeklyHabitDelete", adminWeeklyHabitLambda),
            authorizer,
        });
        // 위클리 해빗 영상 Multipart 업로드 (관리자)
        httpApi.addRoutes({
            path: "/weekly-habit/videos/{program}/{weekNumber}/multipart/initiate",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("WeeklyHabitMpInit", weeklyHabitMpInitiateLambda),
            authorizer,
        });
        httpApi.addRoutes({
            path: "/weekly-habit/videos/{program}/{weekNumber}/multipart/part",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("WeeklyHabitMpPart", weeklyHabitMpPartLambda),
            authorizer,
        });
        httpApi.addRoutes({
            path: "/weekly-habit/videos/{program}/{weekNumber}/multipart/complete",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("WeeklyHabitMpComplete", weeklyHabitMpCompleteLambda),
            authorizer,
        });
        // 사용자용 (인증 필요)
        // GET /public/weekly-habit/{program}/{weekNumber} — 해당 주차 습관 조회
        httpApi.addRoutes({
            path: "/public/weekly-habit/{program}/{weekNumber}",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("PublicWeeklyHabit", publicWeeklyHabitLambda),
            authorizer,
        });
        // POST /user/habit-tracking — 습관 체크 기록
        httpApi.addRoutes({
            path: "/user/habit-tracking",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UserHabitTrackingPost", userHabitTrackingLambda),
            authorizer,
        });
        // GET /user/habit-tracking/{weekNumber} — 주차별 체크 기록 조회
        httpApi.addRoutes({
            path: "/user/habit-tracking/{weekNumber}",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UserHabitTrackingGet", userHabitTrackingLambda),
            authorizer,
        });
        /* ===============================
           수면 습관 관리 Lambdas (관리자 입력 → 사용자 누적 표시)
        =============================== */
        // 관리자: 수면 습관 CRUD
        const adminSleepHabitLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "AdminSleepHabitLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-sleep-habit.ts"),
            handler: "handler",
            environment: {
                SLEEP_HABIT_TABLE_NAME: sleepHabitTable.tableName,
            },
        });
        sleepHabitTable.grantReadWriteData(adminSleepHabitLambda);
        // 사용자: 누적 수면 습관 조회
        const publicSleepHabitLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "PublicSleepHabitLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
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
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("AdminSleepHabitList", adminSleepHabitLambda),
            authorizer,
        });
        // GET /admin/sleep-habit/{program}/{weekNumber} — 특정 주차 조회
        httpApi.addRoutes({
            path: "/admin/sleep-habit/{program}/{weekNumber}",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("AdminSleepHabitGet", adminSleepHabitLambda),
            authorizer,
        });
        // PUT /admin/sleep-habit/{program}/{weekNumber} — 저장/수정
        httpApi.addRoutes({
            path: "/admin/sleep-habit/{program}/{weekNumber}",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.PUT],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("AdminSleepHabitPut", adminSleepHabitLambda),
            authorizer,
        });
        // DELETE /admin/sleep-habit/{program}/{weekNumber} — 삭제
        httpApi.addRoutes({
            path: "/admin/sleep-habit/{program}/{weekNumber}",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.DELETE],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("AdminSleepHabitDelete", adminSleepHabitLambda),
            authorizer,
        });
        // 사용자용 API 엔드포인트 (인증 필요)
        // GET /public/sleep-habit/{program}/{weekNumber} — 누적 수면 습관 조회
        httpApi.addRoutes({
            path: "/public/sleep-habit/{program}/{weekNumber}",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("PublicSleepHabit", publicSleepHabitLambda),
            authorizer,
        });
        /* ===============================
           PSQI 수면 품질 검사 (DynamoDB + Lambda + API)
        =============================== */
        // PSQI 결과 저장 테이블
        const psqiResultsTable = new aws_cdk_lib_1.aws_dynamodb.Table(this, "PSQIResultsTable", {
            partitionKey: { name: "userId", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            sortKey: { name: "testDate", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            billingMode: aws_cdk_lib_1.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // PSQI Lambda
        const userPsqiResultLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "UserPSQIResultLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
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
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UserPSQIResultPost", userPsqiResultLambda),
            authorizer,
        });
        // GET /user/psqi-result — PSQI 결과 조회
        httpApi.addRoutes({
            path: "/user/psqi-result",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UserPSQIResultGet", userPsqiResultLambda),
            authorizer,
        });
        /* ===============================
           자율신경 자가 체크 (DynamoDB + Lambda + API)
        =============================== */
        // 자가 체크 결과 저장 테이블
        const selfCheckResultsTable = new aws_cdk_lib_1.aws_dynamodb.Table(this, "SelfCheckResultsTable", {
            partitionKey: { name: "userId", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            sortKey: { name: "testDate", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            billingMode: aws_cdk_lib_1.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // 자가 체크 Lambda
        const userSelfCheckResultLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "UserSelfCheckResultLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
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
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UserSelfCheckResultPost", userSelfCheckResultLambda),
            authorizer,
        });
        // GET /user/selfcheck-result — 자가 체크 결과 조회
        httpApi.addRoutes({
            path: "/user/selfcheck-result",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UserSelfCheckResultGet", userSelfCheckResultLambda),
            authorizer,
        });
        /* ===============================
           수면 기록 + 습관 체크 (DynamoDB + Lambda + API)
        =============================== */
        // 수면 기록 테이블
        const userSleepLogTable = new aws_cdk_lib_1.aws_dynamodb.Table(this, "UserSleepLogTable", {
            partitionKey: { name: "userId", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            sortKey: { name: "logKey", type: aws_cdk_lib_1.aws_dynamodb.AttributeType.STRING },
            billingMode: aws_cdk_lib_1.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // 수면 기록 Lambda
        const userSleepLogLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "UserSleepLogLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
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
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UserSleepLogPost", userSleepLogLambda),
            authorizer,
        });
        // GET /user/sleep-log — 수면 기록 조회
        httpApi.addRoutes({
            path: "/user/sleep-log",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UserSleepLogGet", userSleepLogLambda),
            authorizer,
        });
        // POST /user/sleep-log/config — 습관 설정 저장
        httpApi.addRoutes({
            path: "/user/sleep-log/config",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UserSleepLogConfigPost", userSleepLogLambda),
            authorizer,
        });
        // GET /user/sleep-log/config — 습관 설정 조회
        httpApi.addRoutes({
            path: "/user/sleep-log/config",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UserSleepLogConfigGet", userSleepLogLambda),
            authorizer,
        });
        /* ===============================
           사용자 프로필 (온보딩 데이터 저장)
        =============================== */
        const userProfileLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "UserProfileLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
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
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.PUT],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UserProfilePut", userProfileLambda),
            authorizer,
        });
        // GET /user/profile — 프로필 조회
        httpApi.addRoutes({
            path: "/user/profile",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UserProfileGet", userProfileLambda),
            authorizer,
        });
        // POST /user/record-login — 로그인 시각 기록
        httpApi.addRoutes({
            path: "/user/record-login",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.POST],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("UserRecordLogin", userProfileLambda),
            authorizer,
        });
        /* ===============================
           관리자 대시보드 통계
        =============================== */
        const adminDashboardStatsLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "AdminDashboardStatsLambda", {
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "..", "lambda", "admin-dashboard-stats.ts"),
            handler: "handler",
            timeout: cdk.Duration.seconds(30),
            environment: {
                USERS_TABLE_NAME: usersTable.tableName,
                USER_POOL_ID: userPool.userPoolId,
            },
        });
        usersTable.grantReadData(adminDashboardStatsLambda);
        adminDashboardStatsLambda.addToRolePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ["cognito-idp:ListUsers"],
            resources: [userPool.userPoolArn],
        }));
        // GET /admin/dashboard-stats — 대시보드 통계
        httpApi.addRoutes({
            path: "/admin/dashboard-stats",
            methods: [aws_apigatewayv2_alpha_1.HttpMethod.GET],
            integration: new aws_apigatewayv2_integrations_alpha_1.HttpLambdaIntegration("AdminDashboardStats", adminDashboardStatsLambda),
            authorizer,
        });
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
exports.HealechoStack = HealechoStack;
