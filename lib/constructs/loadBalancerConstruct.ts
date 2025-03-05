// lib/constructs/loadBalancerConstruct.ts
import { Construct } from "constructs";
import {
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_elasticloadbalancingv2_targets as elbv2_targets,
  aws_certificatemanager as acm,
} from "aws-cdk-lib";

interface LoadBalancerConstructProps {
  envKey: "dev" | "prod";
  vpc: ec2.IVpc;
  ec2Instance: ec2.Instance;
  certificateArn: string;
  albSecurityGroup: ec2.ISecurityGroup;
}

export class LoadBalancerConstruct extends Construct {
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: LoadBalancerConstructProps) {
    super(scope, id);

    // Import existing certificate (already created in AWS Console)
    const certificate = acm.Certificate.fromCertificateArn(this, "ImportedCertificate", props.certificateArn);

    // Use the SG passed in from the stack rather than creating a new one here
    // (So we remove the security group creation logic and references to albAllowedCIDR.)
    const albSecurityGroup = props.albSecurityGroup;

    // Create the ALB with the existing ALB SG
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, `ApplicationLoadBalancer-${props.envKey}`, {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      loadBalancerName: `dify-alb-${props.envKey}`,
    });

    // HTTP Listener => Redirect to HTTPS
    this.loadBalancer.addListener("HttpListener", {
      port: 80,
      open: true,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: "HTTPS",
        port: "443",
        permanent: true,
      }),
    });

    // HTTPS Listener
    const httpsListener = this.loadBalancer.addListener("HttpsListener", {
      port: 443,
      open: true,
      certificates: [certificate],
    });

    // Forward traffic to the EC2 instance
    httpsListener.addTargets("EC2Target", {
      port: 80, // ALB 443 => Instance 80
      targets: [new elbv2_targets.InstanceTarget(props.ec2Instance)],
      healthCheck: {
        path: "/apps",
      },
      targetGroupName: `dify-tg-${props.envKey}`,
    });
  }
}
