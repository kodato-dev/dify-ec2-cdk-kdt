// lib/difyCdkStack.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NetworkConstruct } from "./constructs/networkConstruct";
import { SecurityConstruct } from "./constructs/securityConstruct";
import { EC2InstanceConstruct } from "./constructs/ec2InstanceConstruct";
import { LoadBalancerConstruct } from "./constructs/loadBalancerConstruct";
import { aws_ec2 as ec2 } from "aws-cdk-lib";

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
    const keyName = new cdk.CfnParameter(this, "KeyName", {
      type: "String",
      default: "dify-key",
      description: "KeyName to use for EC2 instance",
    });

    // Use a hard-coded value for the Amazon Linux AMI SSM Parameter
    const amazonLinuxAMI = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64";

    // 1) Create the VPC
    const network = new NetworkConstruct(this, "NetworkConstruct", {
      envKey: props.envKey,
      vpcCIDR: vpcCIDR.valueAsString,
      subnet1CIDR: subnet1CIDR.valueAsString,
      subnet2CIDR: subnet2CIDR.valueAsString,
    });

    // 2) Create the ALB Security Group in the Stack
    //    so we can pass it into both SecurityConstruct (for the EC2 inbound rule)
    //    and LoadBalancerConstruct (for the ALB itself).
    const albSecurityGroup = new ec2.SecurityGroup(this, `ApplicationLoadBalancerSecurityGroup-${props.envKey}`, {
      vpc: network.vpc,
      description: `Security Group for ALB - env: ${props.envKey}`,
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(
      ec2.Peer.ipv4("0.0.0.0/0"),
      ec2.Port.tcp(80),
      "Allow HTTP from the world"
    );
    albSecurityGroup.addIngressRule(
      ec2.Peer.ipv4("0.0.0.0/0"),
      ec2.Port.tcp(443),
      "Allow HTTPS from the world"
    );

    // 3) Define which 4 IPs are allowed for SSH
    //    (Replace these with real IPs!)
    const sshAllowedIPs = [
      "1.1.1.1/32",
      "2.2.2.2/32",
      "3.3.3.3/32",
      "4.4.4.4/32",
    ];

    // 4) Create the SecurityConstruct (for the EC2 instance)
    //    Pass the ALB SG and the list of SSH IPs
    const security = new SecurityConstruct(this, "SecurityConstruct", {
      envKey: props.envKey,
      vpc: network.vpc,
      albSecurityGroup: albSecurityGroup,
      sshAllowedIPs: sshAllowedIPs,
    });

    // 5) Create the EC2 instance
    const ec2Instance = new EC2InstanceConstruct(this, "EC2InstanceConstruct", {
      envKey: props.envKey,
      vpc: network.vpc,
      subnet: network.subnet1,
      securityGroup: security.securityGroup, // Security group from our SecurityConstruct
      keyName: keyName.valueAsString,
      amazonLinuxAMI: amazonLinuxAMI,
    });

    // 6) Create the Load Balancer
    const albConstruct = new LoadBalancerConstruct(this, "LoadBalancerConstruct", {
      envKey: props.envKey,
      vpc: network.vpc,
      ec2Instance: ec2Instance.instance,
      certificateArn: props.certificateArn ?? "",
      albSecurityGroup: albSecurityGroup, // Reuse the SG we created above
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
