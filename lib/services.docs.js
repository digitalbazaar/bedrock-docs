/*
 * Copyright (c) 2012-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const config = require('bedrock').config;
const fs = require('fs');
const path = require('path');
const os = require('os');
const raml2html = require('raml2html');

// module API
const api = {};
module.exports = api;

// API documentation
let ramlSource = '';
let ramlHtml = '';

const logger = bedrock.loggers.get('app').child('bedrock-docs');

bedrock.events.on('bedrock-express.ready', (app, callback) => {
  const docs = require('./index');
  const serviceMap = {};

  // perform discovery on all of the endpoints
  // TODO: if an express 4.x custom router is used via express.Router(),
  // then we won't have access to those routes here; we need to expose
  // something to allow people to register routers that use that method
  const routes = app._router.stack;
  _.each(routes, service => {
    if(service.route) {
      const rawPath = service.route.path;
      const path = rawPath.replace(/(\:[a-zA-Z0-9]+)/g, v =>
        '{' + v.replace(':', '') + '}');

      if(!serviceMap.hasOwnProperty(path)) {
        serviceMap[path] = [];
      }

      serviceMap[path].push(service);
    }
  });

  // remove duplicates
  _.each(Object.keys(serviceMap), key => {
    serviceMap[key] = _.uniqWith(serviceMap[key], (value, other) =>
      _.isEqual(value.route.methods, other.route.methods));
  });

  // Remove default handlers and blacklisted endpoints
  delete serviceMap['*'];
  _.each(bedrock.config.docs.ignore, path => {
    const ignorePath = path.replace(/(\:[a-zA-Z0-9]+)/g, v =>
      '{' + v.replace(':', '') + '}');
    delete serviceMap[ignorePath];
  });

  // generate the base RAML source file by stitching together sections
  const sections = bedrock.config.docs.sections;
  // if true, RAML documentation sections have been started
  let docSectionsStarted = false;
  async.eachSeries(sections, (section, callback) => {
    const docPaths = bedrock.config.docs.paths;
    const docVars = bedrock.config.docs.vars;

    docs.loadFile(section, docPaths, docVars, (err, data) => {
      let sectionText = data;
      if(err) {
        return callback(err);
      }
      // if string ends with a '.md'
      if(section.indexOf('.md', section.length - 3) !== -1) {
        if(!docSectionsStarted) {
          ramlSource += 'documentation:\n';
          docSectionsStarted = true;
        }
        const sectionTitle = sectionText.match(/^#{1,6}\s(.*)\s$/m)[1];
        // remove the first line of the markdown text
        sectionText = sectionText.replace(/^.*$\n/m, '');
        // indent the section text properly
        sectionText = sectionText.replace(/\n/g, '\n     ');

        ramlSource += ' - title: ' + sectionTitle +
          '\n   content: |\n     ' + sectionText + '\n';
      } else {
        // assume a RAML snippet designed to be concatenated together
        ramlSource += sectionText;
      }
      callback();
    });
  }, err => {
    if(err) {
      logger.error(
        'failed to load section of REST API documentation', {error: err});
      return callback();
    }
    _buildDocs(serviceMap, err => {
      if(err) {
        logger.error('failed to build REST API documentation', {error: err});
      }

      callback();
    });
  });
});

// add routes
// FIXME: Race condition - this may be exposed before the documentation is built
bedrock.events.on('bedrock-express.configure.routes', app => {
  // add the /docs route
  app.get('/docs', (req, res) => res.send(ramlHtml));
});

/**
 * Builds the REST API documentation given a map of all URL endpoints served
 * by the system.
 *
 * @param serviceMap a URL map of all service endpoints for the system.
 * @param callback(err) called once the documentation has been built.
 */
function _buildDocs(serviceMap, callback) {
  const docs = require('./index');
  let index = 0;
  const categoryMap = bedrock.config.docs.categories;
  const endpointKeys = _.union(_.keys(serviceMap), _.keys(categoryMap)).sort();
  const endpointKeysCopy = bedrock.util.clone(endpointKeys);
  async.eachSeries(endpointKeys, (key, callback) => {
    // find a parent path, if any
    let currentPath = null;
    let parentPath = '';
    for(let i = index - 1; i >= 0; i--) {
      if(key.indexOf(endpointKeysCopy[i]) === 0) {
        parentPath = endpointKeysCopy[i];
        currentPath = key.replace(endpointKeysCopy[i], '');
        // a differenence greater than 0 means that there is a missing parent
        const missingParent = (currentPath.split('/').length -
          parentPath.split('/').length) > 0;
        // if the current path doesn't start with a /, it was a false match
        if(!currentPath.startsWith('/')) {
          parentPath = '';
          currentPath = null;
        } else {
          if(missingParent) {
            // add missing parents later, the value of parentPath is preserved
            currentPath = null;
          }
          break;
        }
      }
    }
    index++;
    if(!currentPath) {
      currentPath = key;
      const currentPathSplit = currentPath.split('/');
      const depthCurrent = currentPathSplit.length - 1;
      if(depthCurrent > 1) {
        // this is a path with unregistered parents, inject fake parents
        for(let i = 1; i < depthCurrent; ++i) {
          const newPath = `/${currentPathSplit.slice(1, i + 1).join('/')}`;
          if(parentPath === newPath) {
            // this path already exists
            continue;
          }
          // add the new path to the array of known paths
          endpointKeysCopy.splice(
            endpointKeysCopy.indexOf(currentPath), 0, newPath);
          index++;

          // add the new path to the RAML document
          let indent = '';
          for(let j = 0; j < i - 1; j++) {
            indent += '  ';
          }
          ramlSource += `${indent}/${currentPathSplit[i]}:\n`;
        }
        parentPath = `/${currentPathSplit.slice(1, depthCurrent).join('/')}`;
        currentPath = currentPath.replace(parentPath, '');
      }
    }
    // calculate the indent depth
    let indent = '';
    const depth = parentPath.split('/').length - 1;

    for(let j = 0; j < depth; j++) {
      indent += '  ';
    }

    // create the top-level documentation for the path
    ramlSource += `${indent}${currentPath}:\n`;

    // check to see if this is a category
    if(categoryMap[key]) {
      ramlSource += indent + '  displayName: ' + categoryMap[key] + '\n';

      // go to next entry if purely a category
      if(!serviceMap[key]) {
        return callback();
      }
    }

    // add documentation for each HTTP method
    async.eachSeries(serviceMap[key], (handler, callback) =>
      async.eachSeries(Object.keys(handler.route.methods), (method, callback) =>
        docs.getRaml(method, key, indent + '  ', (err, ramlSnippet) => {
          if(err) {
            if(err.name === 'NotFoundError') {
              logger.error(err.message, err);
            }
            // assume OPTIONS are used to set CORS headers
            // FIXME: Is this an acceptable assumption to make?
            if(method.toUpperCase() !== 'OPTIONS') {
              logger.warning('no HTTP API documentation exists for ' +
                method.toUpperCase() + ' ' + key);
              ramlSource += indent + '  ' + method + ':\n' +
                indent + '    description: undocumented\n';
            }
          }
          if(ramlSnippet) {
            ramlSource += ramlSnippet;
          }
          callback();
        }), callback), callback);

  }, err => {
    if(err) {
      return callback(err);
    }

    // build and cache the HTML documentation
    // const ramlConfig = raml2html.getDefaultConfig();
    const ramlConfig = raml2html.getConfigForTheme();
    const sourceFilename = `${config.server.domain}-pid-${process.pid}.raml`;
    const sourceFile = path.join(os.tmpdir(), sourceFilename);
    fs.writeFileSync(sourceFile, ramlSource);
    logger.debug('RAML file stored successfully', {
      fileName: sourceFile
    });
    raml2html.render(sourceFile, ramlConfig).then(result => {
      logger.debug('RAML rendered to HTML successfully');
      ramlHtml = result;
      callback();
    }, err => {
      // write error RAML file to disk
      const errorFilename =
        `${config.server.domain}-pid-${process.pid}-raml-error.yaml`;
      const tmpFile = path.join(os.tmpdir(), errorFilename);
      fs.writeFileSync(tmpFile, ramlSource);
      logger.error('failed to build REST API documentation', {
        context: err.context,
        message: err.message,
        errorFile: tmpFile,
        line: err.problem_mark.line,
        column: err.problem_mark.column
      });
      callback();
    });
  });
}
