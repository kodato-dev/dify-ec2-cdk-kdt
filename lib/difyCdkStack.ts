// lib/difyCdkStack.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NetworkConstruct } from "./constructs/networkConstruct";
import { SecurityConstruct } from "./constructs/securityConstruct";
import { EC2InstanceConstruct } from "./constructs/ec2InstanceConstruct";
import { LoadBalancerConstruct } from "./constructs/loadBalancerConstruct";
import * as ec2 from "aws-cdk-lib/aws-ec2";

// --- Updated interface with required envKey and certificateArn ---
interface DifyStackProps extends cdk.StackProps {
  envKey: "dev" | "prod"; // Made envKey required
  certificateArn?: string; // Added certificateArn as an optional prop
}

export class DifyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DifyStackProps) {
    super(scope, id, props);

    // Reference envKey if needed
    console.log("Deploying environment:", props.envKey);

    // CloudFormation Parameters
    const vpcCIDR = new cdk.CfnParameter(this, "VpcCIDR", {
      type: "String",
      default: "192.168.0.0/16",
      description: "CIDR block for the VPC",
    });
    const subnet1CIDR = new cdk.CfnParameter(this, "Subnet1CIDR", {
      type: "String",
      default: "192.168.0.0/20",
      description: "CIDR block for Subnet 1",
    });
    const subnet2CIDR = new cdk.CfnParameter(this, "Subnet2CIDR", {
      type: "String",
      default: "192.168.16.0/20",
      description: "CIDR block for Subnet 2",
    });
    const allowedCIDR = new cdk.CfnParameter(this, "AllowedCIDR", {
      type: "String",
      default: "0.0.0.0/0",
      description: "CIDR block to allow HTTP and SSH traffic from",
    });
    const keyName = new cdk.CfnParameter(this, "KeyName", {
      type: "String",
      default: "dify-key",
      description: "KeyName to use for EC2 instance",
    });

    // Use a hard-coded value for the Amazon Linux AMI SSM Parameter
    const amazonLinuxAMI = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64";

    // Instantiate Constructs
    const network = new NetworkConstruct(this, "NetworkConstruct", {
      envKey: props.envKey,
      vpcCIDR: vpcCIDR.valueAsString,
      subnet1CIDR: subnet1CIDR.valueAsString,
      subnet2CIDR: subnet2CIDR.valueAsString,
    });

    const security = new SecurityConstruct(this, "SecurityConstruct", {
      envKey: props.envKey,
      vpc: network.vpc,
      allowedCIDR: allowedCIDR.valueAsString,
    });

    const ec2Instance = new EC2InstanceConstruct(this, "EC2InstanceConstruct", {
      envKey: props.envKey,
      vpc: network.vpc,
      subnet: network.subnet1,
      securityGroup: security.securityGroup,
      keyName: keyName.valueAsString,
      amazonLinuxAMI: amazonLinuxAMI,
    });

    const albConstruct = new LoadBalancerConstruct(this, "LoadBalancerConstruct", {
      envKey: props.envKey,
      vpc: network.vpc,
      ec2Instance: ec2Instance.instance,
      certificateArn: props.certificateArn ?? "",
    });

    new cdk.CfnOutput(this, "ALBEndpoint", {
      value: albConstruct.loadBalancer.loadBalancerDnsName,
      description: "DNS name of the Application Load Balancer",
      exportName: `DifyALBDnsName-${props.envKey}`,
    });

    // Outputs with unique export names per environment
    new cdk.CfnOutput(this, "InstancePublicIP", {
      value: ec2Instance.instance.instancePublicIp,
      description: "Public IP of the EC2 instance",
      exportName: `DifyInstancePublicIP-${props.envKey}`, // Unique export name
    });

    new cdk.CfnOutput(this, "InstanceId", {
      value: ec2Instance.instance.instanceId,
      description: "InstanceId of the EC2 instance",
      exportName: `DifyInstanceId-${props.envKey}`, // Unique export name
    });
  }
}
