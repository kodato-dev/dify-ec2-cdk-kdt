// lib/constructs/ec2InstanceConstruct.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_ec2 as ec2, aws_iam as iam } from "aws-cdk-lib";

interface EC2InstanceConstructProps {
  envKey: "dev" | "prod";
  vpc: ec2.IVpc;
  subnet: ec2.ISubnet;
  securityGroup: ec2.SecurityGroup;
  keyName: string;
  amazonLinuxAMI: string;
}

export class EC2InstanceConstruct extends Construct {
  public readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, props: EC2InstanceConstructProps) {
    super(scope, id);

    // Create IAM Role
    const role = new iam.Role(this, `DifyWebServerInstanceRole-${props.envKey}`, {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonBedrockFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });

    // Create Instance Profile
    const instanceProfile = new iam.CfnInstanceProfile(this, `InstanceProfile-${props.envKey}`, {
      roles: [role.roleName],
    });

    // Define User Data script
    const userDataScript = `#!/bin/bash
max_attempts=5
attempt_num=1
success=false
while [ $success = false ] && [ $attempt_num -le $max_attempts ]; do
  sudo dnf install -y git docker
  if [ $? -eq 0 ]; then
    echo "dnf install succeeded"
    success=true
  else
    echo "dnf install $attempt_num failed. trying again..."
    sleep 3
    ((attempt_num++))
  fi
done

sudo systemctl start docker
sudo gpasswd -a ec2-user docker
sudo gpasswd -a ssm-user docker
sudo chgrp docker /var/run/docker.sock
sudo service docker restart
sudo systemctl enable docker
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
cd /opt
sudo git clone https://github.com/kodato-dev/forked-dify.git dify
cd /opt/dify
sudo git pull origin main
cd /opt/dify/docker
sudo cp .env.example .env
docker-compose up -d
`;

    // Create EC2 Instance
    this.instance = new ec2.Instance(this, `DifyWebServerInstance-${props.envKey}`, {
      instanceType: new ec2.InstanceType("t3.medium"),
      machineImage: ec2.MachineImage.fromSsmParameter(props.amazonLinuxAMI),
      vpc: props.vpc,
      vpcSubnets: { subnets: [props.subnet] },
      keyName: props.keyName,
      securityGroup: props.securityGroup,
      role: role,
      userData: ec2.UserData.custom(userDataScript),
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(20, {
            volumeType: ec2.EbsDeviceVolumeType.GP2,
            encrypted: true,
          }),
        },
      ],
    });

    // Add dependency on Instance Profile
    this.instance.instance.addDependency(instanceProfile);
  }
}
