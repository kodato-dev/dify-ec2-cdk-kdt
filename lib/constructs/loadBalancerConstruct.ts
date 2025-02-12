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
  albAllowedCIDR?: string;
  certificateArn: string;
}

export class LoadBalancerConstruct extends Construct {
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: LoadBalancerConstructProps) {
    super(scope, id);

    // Import existing certificate (already created in AWS Console)
    const certificate = acm.Certificate.fromCertificateArn(this, "ImportedCertificate", props.certificateArn);

    // ALB security group (allows HTTP and HTTPS in)
    const albSecurityGroup = new ec2.SecurityGroup(this, `ApplicationLoadBalancerSecurityGroup-${props.envKey}`, {
      vpc: props.vpc,
      description: `Security Group for ALB - env: ${props.envKey}`,
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.albAllowedCIDR ?? "0.0.0.0/0"),
      ec2.Port.tcp(80),
      "Allow HTTP from the world (or specified CIDR)"
    );
    albSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.albAllowedCIDR ?? "0.0.0.0/0"),
      ec2.Port.tcp(443),
      "Allow HTTPS from the world (or specified CIDR)"
    );

    // Create the ALB
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

    // Corrected Line: Wrap the instance in an InstanceTarget, plus assigning a target group name
    httpsListener.addTargets("EC2Target", {
      port: 80, // traffic will be forwarded from ALB:443 => Instance:80
      targets: [new elbv2_targets.InstanceTarget(props.ec2Instance)],
      healthCheck: {
        path: "/apps",
      },
      targetGroupName: `dify-tg-${props.envKey}`,
    });
  }
}
