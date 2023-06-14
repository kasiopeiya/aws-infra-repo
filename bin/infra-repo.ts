#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfraRepoStack } from '../lib/infra-repo-stack';

const app = new cdk.App();
new InfraRepoStack(app, 'InfraRepoStack');
