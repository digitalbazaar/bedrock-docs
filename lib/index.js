/*
 * Bedrock documentation module.
 *
 * Copyright (c) 2012-2017 Digital Bazaar, Inc. All rights reserved.
 */
const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');
const bedrock = require('bedrock');
const BedrockError = bedrock.util.BedrockError;
require('bedrock-validation');

// load config defaults
require('./config');

const api = {};
module.exports = api;

// the annotation module
const annotate = {};

// the REST API annotations
const docs = {
  get: {},
  post: {},
  put: {},
  patch: {},
  'delete': {},
  options: {}
};

/**
 * Retrieve a RAML annotation for a particular method and path. The indentation
 * level must be provided.
 *
 * @param method the HTTP method.
 * @param path the full REST API path in RAML format (using '{' and '}' for
 *          path variables.)
 * @param indent a string of spaces based on the indent level.
 * @param callback(err, ramlSnippet) an error, or a RAML string that can be
 *          injected into a master RAML file.
 */
api.getRaml = (method, path, indent, callback) => {
  // get the RAML documentation for a particular method and path

  // if `app.all` is used on a route, several `method` values will pass through
  // here that are not defined in `docs`
  const doc = _.get(docs, `${method}.${path}`);

  let raml = null;
  // end early if there is no documentation for the method and path
  if(!doc) {
    return callback(new BedrockError(
      'No documentation exists for given HTTP API method and path.',
      'NoDocumentation', {
        method: method,
        path: path
      }));
  }

  raml = '';

  // add method type
  if(!doc.hide) {
    raml += indent + method + ':\n';
    indent += '  ';
  }

  // add description
  if(doc.description) {
    raml += indent + 'description: ' + doc.description + '\n';
  }
  // add security protections
  if(doc.securedBy) {
    raml += indent + 'securedBy: [' + doc.securedBy + ']\n';
  }

  // end early if there is no response documentation for the method/path
  if(!doc.responses) {
    return callback(null, raml);
  }

  // add documentation on response codes
  raml += indent + 'responses:\n';
  const sortedCodes = _.keys(doc.responses).sort();
  async.eachSeries(sortedCodes, (code, callback) => {
    raml += indent + '  ' + code + ':\n';

    // handle simple docs for responses
    if(_.isString(doc.responses[code])) {
      // add description for the response code
      raml += indent + '    description: ' + doc.responses[code] + '\n';
      return callback();
    }

    if(!_.isObject(doc.responses[code])) {
      return callback();
    }

    // handle complex docs with examples
    // add detailed description for response code
    const sortedTypes = _.keys(doc.responses[code]);
    async.eachSeries(sortedTypes, (resType, callback) => {
      const example = doc.responses[code][resType].example;
      raml += indent + '    body: \n';
      raml += indent + '      ' + resType + ':\n';

      // return if there isn't an example
      if(!example) {
        return callback();
      }
      // return if the example doesn't end in .jsonld
      if(example.indexOf('.jsonld', example.length - 7) === -1) {
        return callback();
      }

      // process JSON-LD example files
      const docPaths = bedrock.config.docs.paths;
      const docVars = bedrock.config.docs.vars;
      api.loadFile(example, docPaths, docVars, (err, data) => {
        if(err) {
          return callback(err);
        }
        const formattedExample = indent + '          ' +
          data.replace(/\n/g, '\n' + indent + '          ');
        raml += indent + '        example: |\n' +
          formattedExample + '\n';
        callback();
      });
    }, callback);
  }, err => callback(err, raml));
};

/**
 * Loads a documentation file from disk, making the appropriate template
 * replacements.
 *
 */
api.loadFile = (section, paths, vars, callback) => {
  const docFiles = [];

  // build the list of possible files
  _.each(paths, docPath => docFiles.push(path.join(docPath, section)));

  // search the website documentation paths for the document
  async.detectSeries(docFiles, (fileName, callback) =>
    fs.access(fileName, fs.constants.R_OK, err => callback(null, !err)),
  (err, fileName) => {
    if(err) {
      return callback(err);
    }
    if(!fileName) {
      return callback(new BedrockError(
        'Failed to locate REST API documentation file.',
        'NotFoundError',
        {docFiles, section}));
    }

    // read the website docs
    fs.readFile(fileName, {encoding: 'utf8'}, (err, data) => {
      let docText = data;
      if(err) {
        return callback(new BedrockError(
          'Failed to load REST API section file.',
          'NotReadableError',
          {fileName, error: err}));
      }
      // replace the documentation template variables
      _.each(_.keys(vars), docVar => {
        const replacement = vars[docVar];
        const re = new RegExp('\\{\\{' + docVar + '\\}\\}', 'g');
        docText = docText.replace(re, replacement);
      });

      callback(null, docText);
    });
  });
};

/**
 * Documents a particular method and path of the system.
 *
 * @param method the HTTP method name.
 * @param path the HTTP path from the root of the server. The path may include
 *   named variables like /i/:identity.
 * @param doc the documentation object for the given path
 *   views/docs/ directory.
 */
api.document = (method, path, doc) => {
  const ramlPath = path.replace(/(\:[a-zA-Z0-9]+)/g, v =>
    '{' + v.replace(':', '') + '}');
  docs[method][ramlPath] = doc;
};

// short-hand aliases for the documentation methods
annotate.get = (path, docs) => {
  docs.method = 'get';
  api.document('get', path, docs);
};

annotate.post = (path, docs) => {
  docs.method = 'post';
  api.document('post', path, docs);
};

annotate.put = (path, docs) => {
  docs.method = 'put';
  api.document('put', path, docs);
};

annotate.patch = (path, docs) => {
  docs.method = 'patch';
  api.document('patch', path, docs);
};

annotate.delete = (path, docs) => {
  docs.method = 'delete';
  api.document('delete', path, docs);
};

api.annotate = annotate;

require('./services.docs');
