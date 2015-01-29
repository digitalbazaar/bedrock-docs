/*
 * Bedrock Documentation Module Configuration
 *
 * Copyright (c) 2012-2015 Digital Bazaar, Inc. All rights reserved.
 */
var config = require('bedrock').config;
var path = require('path');
require('bedrock-validation');

config.docs = {};
config.docs.paths = [
  path.join(__dirname, '..', 'docs')
];
config.docs.sections = [
  'base.raml',
  'authentication.md',
  'limits.md'
];
config.docs.vars = {
  brand: 'BRAND',
  baseUri: 'https://localhost'
};
config.docs.categories = {
  '/.well-known': 'Service Discovery',
  '/i': 'Identity Services',
  '/identifier': 'Identifier Services',
  '/session': 'Session Management'
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
