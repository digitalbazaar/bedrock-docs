/*
 * Bedrock Documentation Module Configuration
 *
 * Copyright (c) 2012-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');
const path = require('path');

config.docs = {};
config.docs.paths = [
  path.join(__dirname, '..', 'docs')
];
config.docs.sections = [
  'base.raml',
  'limits.md'
];
config.docs.vars = {
  brand: 'BRAND',
  baseUri: 'https://localhost'
};

config.docs.categories = {
};

config.docs.ignore = [
  '/',
  '/about',
  '/contact',
  '/docs',
  '/help',
  '/i/:identity/dashboard',
  '/i/:identity/settings',
  '/join',
  '/legal'
];

// common validation schemas
config.validation.schema.paths.push(
  path.join(__dirname, '..', 'schemas')
);
