/*
 * Copyright (c) 2012-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const getDocsQuery = {
  type: 'object',
  properties: {
    topic: {
      type: 'string',
      minLength: 1
    }
  }
};

module.exports.getDocsQuery = () => getDocsQuery;
