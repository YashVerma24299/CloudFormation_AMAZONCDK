import * as cdk from 'aws-cdk-lib';
import {
  CfnInternetGateway,
  CfnRoute,
  CfnVPCGatewayAttachment,
  SubnetType,
  Vpc
} from 'aws-cdk-lib/aws-ec2';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class ExpenseTrackerServicesDeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC
    const vpc = new Vpc(this, "MyVpc", {
      vpcName: "expenseTrackerCDK",
      ipAddresses: cdk.aws_ec2.IpAddresses.cidr("10.0.0.0/16"),
      maxAzs: 2,

      // IMPORTANT: No NAT Gateway (avoids charges)
      natGateways: 0,

      subnetConfiguration: [
        {
          name: "PublicSubnet",
          subnetType: SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "PrivateSubnet",
          // Private subnet without NAT
          subnetType: SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Create Internet Gateway
    const igw = new CfnInternetGateway(this, "InternetGateway");

    // Attach Internet Gateway to VPC
    new CfnVPCGatewayAttachment(this, "InternetGatewayAttachment", {
      vpcId: vpc.vpcId,
      internetGatewayId: igw.ref,
    });

    // Public Route -> Internet
    vpc.publicSubnets.forEach((subnet, index) => {
      new CfnRoute(this, `PublicRoute${index}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: "0.0.0.0/0",
        gatewayId: igw.ref,
      });
    });

    // Store VPC ID
    new StringParameter(this, "VpcIdParameter", {
      parameterName: "/expense-tracker/vpc-id",
      stringValue: vpc.vpcId,
    });

    // Store Public Subnets
    vpc.publicSubnets.forEach((subnet, index) => {
      new StringParameter(this, `PublicSubnet${index}`, {
        parameterName: `/expense-tracker/public-subnet-${index}`,
        stringValue: subnet.subnetId,
      });
    });

    // Store Private Subnets
    vpc.privateSubnets.forEach((subnet, index) => {
      new StringParameter(this, `PrivateSubnet${index}`, {
        parameterName: `/expense-tracker/private-subnet-${index}`,
        stringValue: subnet.subnetId,
      });
    });

    // Outputs
    new cdk.CfnOutput(this, "VpcId", {
      value: vpc.vpcId,
    });

    new cdk.CfnOutput(this, "PublicSubnet1", {
      value: vpc.publicSubnets[0].subnetId,
    });

    new cdk.CfnOutput(this, "PublicSubnet2", {
      value: vpc.publicSubnets[1].subnetId,
    });

    new cdk.CfnOutput(this, "PrivateSubnet1", {
      value: vpc.privateSubnets[0].subnetId,
    });

    new cdk.CfnOutput(this, "PrivateSubnet2", {
      value: vpc.privateSubnets[1].subnetId,
    });
  }
}