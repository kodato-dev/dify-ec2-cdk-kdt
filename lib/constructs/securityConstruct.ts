// lib/constructs/securityConstruct.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_ec2 as ec2 } from "aws-cdk-lib";

interface SecurityConstructProps {
  envKey: "dev" | "prod";
  vpc: ec2.IVpc; // Using ec2.IVpc
  allowedCIDR: string;
}

export class SecurityConstruct extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityConstructProps) {
    super(scope, id);

    // Create Security Group
    this.securityGroup = new ec2.SecurityGroup(this, `DifySecurityGroup-${props.envKey}`, {
      vpc: props.vpc,
      securityGroupName: `dify-security-group-${props.envKey}`,
      description: `Allow HTTP and SSH traffic for env: ${props.envKey}`,
      allowAllOutbound: true,
    });

    // Inbound Rules
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.allowedCIDR),
      ec2.Port.tcp(80),
      "Allow HTTP traffic from allowed CIDR"
    );

    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.allowedCIDR),
      ec2.Port.tcp(22),
      "Allow SSH traffic from allowed CIDR"
    );
  }
}
