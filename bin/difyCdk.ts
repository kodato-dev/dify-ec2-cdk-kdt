#!/usr/bin/env node
// bin/difyCdk.ts
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DifyStack } from "../lib/difyCdkStack";

const app = new cdk.App();

// --- Added environment context ---
const envKey = app.node.tryGetContext("environment") as "dev" | "prod";
if (!envKey) {
  throw new Error("Please specify the environment in the context option, e.g. cdk deploy -c environment=dev");
}

const stackName = `DifyStack-${envKey}`;

const certificateArn = process.env.CERTIFICATE_ARN;

new DifyStack(app, stackName, {
  stackName: stackName,
  envKey: envKey,
  certificateArn,
});
