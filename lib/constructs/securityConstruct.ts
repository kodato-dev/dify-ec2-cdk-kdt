// lib/constructs/securityConstruct.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_ec2 as ec2 } from "aws-cdk-lib";

interface SecurityConstructProps {
  envKey: "dev" | "prod";
  vpc: ec2.IVpc;
  // Instead of 'allowedCIDR' for HTTP, we accept the ALB's Security Group
  albSecurityGroup: ec2.ISecurityGroup;
  // We also accept an array of IP strings for SSH
  sshAllowedIPs: string[];
}

export class SecurityConstruct extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityConstructProps) {
    super(scope, id);

    // Create Security Group for the EC2 instance
    this.securityGroup = new ec2.SecurityGroup(this, `DifySecurityGroup-${props.envKey}`, {
      vpc: props.vpc,
      securityGroupName: `dify-security-group-${props.envKey}`,
      description: `Allow HTTP (from ALB only) and SSH (from 4 IPs) for env: ${props.envKey}`,
      allowAllOutbound: true,
    });

    //
    // HTTP rule: Only allow inbound port 80 from the ALB's SG
    //
    this.securityGroup.addIngressRule(
      ec2.Peer.securityGroupId(props.albSecurityGroup.securityGroupId),
      ec2.Port.tcp(80),
      "Allow HTTP traffic only from the load balancer security group"
    );

    //
    // SSH rules: We allow port 22 from exactly 4 IP addresses
    //
    for (const ip of props.sshAllowedIPs) {
      this.securityGroup.addIngressRule(
        ec2.Peer.ipv4(ip),
        ec2.Port.tcp(22),
        `Allow SSH traffic from ${ip}`
      );
    }
  }
}
