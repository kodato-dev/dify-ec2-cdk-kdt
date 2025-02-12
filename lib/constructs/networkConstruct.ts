// lib/constructs/networkConstruct.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_ec2 as ec2 } from "aws-cdk-lib";

interface NetworkConstructProps {
  envKey: "dev" | "prod";
  vpcCIDR: string;
  subnet1CIDR: string;
  subnet2CIDR: string;
}

export class NetworkConstruct extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly subnet1: ec2.ISubnet;
  public readonly subnet2: ec2.ISubnet;

  constructor(scope: Construct, id: string, props: NetworkConstructProps) {
    super(scope, id);

    // Create VPC using CfnVPC
    const vpcResource = new ec2.CfnVPC(this, `DifyVPC-${props.envKey}`, {
      cidrBlock: props.vpcCIDR,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: [{ key: "Name", value: `DifyVPC-${props.envKey}` }],
    });

    // Get Availability Zones
    const availabilityZones = cdk.Stack.of(this).availabilityZones;

    // Create Internet Gateway
    const internetGateway = new ec2.CfnInternetGateway(this, `InternetGateway-${props.envKey}`, {
      tags: [{ key: "Name", value: `dify-vpc-igw-${props.envKey}` }],
    });

    // Attach Internet Gateway to VPC
    new ec2.CfnVPCGatewayAttachment(this, "VPCGatewayAttachment", {
      vpcId: vpcResource.ref,
      internetGatewayId: internetGateway.ref,
    });

    // Create Route Table
    const routeTable = new ec2.CfnRouteTable(this, `RouteTable-${props.envKey}`, {
      vpcId: vpcResource.ref,
      tags: [{ key: "Name", value: `dify-route-table-${props.envKey}` }],
    });

    // Create Route to Internet Gateway
    new ec2.CfnRoute(this, "Route", {
      routeTableId: routeTable.ref,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: internetGateway.ref,
    });

    // Create Subnet 1 using CfnSubnet
    const subnet1Resource = new ec2.CfnSubnet(this, `Subnet1-${props.envKey}`, {
      vpcId: vpcResource.ref,
      cidrBlock: props.subnet1CIDR,
      availabilityZone: availabilityZones[0],
      mapPublicIpOnLaunch: true,
      tags: [{ key: "Name", value: `dify-subnet-1-${props.envKey}` }],
    });

    // Associate Subnet 1 with Route Table
    new ec2.CfnSubnetRouteTableAssociation(this, "Subnet1RouteTableAssociation", {
      routeTableId: routeTable.ref,
      subnetId: subnet1Resource.ref,
    });

    // Create Subnet 2 using CfnSubnet
    const subnet2Resource = new ec2.CfnSubnet(this, `Subnet2-${props.envKey}`, {
      vpcId: vpcResource.ref,
      cidrBlock: props.subnet2CIDR,
      availabilityZone: availabilityZones[1],
      mapPublicIpOnLaunch: true,
      tags: [{ key: "Name", value: `dify-subnet-2-${props.envKey}` }],
    });

    // Associate Subnet 2 with Route Table
    new ec2.CfnSubnetRouteTableAssociation(this, "Subnet2RouteTableAssociation", {
      routeTableId: routeTable.ref,
      subnetId: subnet2Resource.ref,
    });

    // Import Subnet 1 as ISubnet
    this.subnet1 = ec2.Subnet.fromSubnetAttributes(this, "ImportedSubnet1", {
      subnetId: subnet1Resource.ref,
      availabilityZone: availabilityZones[0],
    });

    // Import Subnet 2 as ISubnet
    this.subnet2 = ec2.Subnet.fromSubnetAttributes(this, "ImportedSubnet2", {
      subnetId: subnet2Resource.ref,
      availabilityZone: availabilityZones[1],
    });

    // Import the VPC as IVpc and provide public subnet IDs
    this.vpc = ec2.Vpc.fromVpcAttributes(this, "ImportedVPC", {
      vpcId: vpcResource.ref,
      availabilityZones: availabilityZones,
      publicSubnetIds: [subnet1Resource.ref, subnet2Resource.ref],
      // Optionally, add publicSubnetRouteTableIds if necessary
      // publicSubnetRouteTableIds: [routeTable.ref, routeTable.ref],
    });
  }
}
