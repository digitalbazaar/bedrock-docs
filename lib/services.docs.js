/*
 * Copyright (c) 2012-2015 Digital Bazaar, Inc. All rights reserved.
 */
var _ = require('underscore');
var async = require('async');
var bedrock = require('bedrock');
var raml2html = require('raml2html');

// constants
var MODULE_NS = 'bedrock.services';

// module API
var api = {};
module.exports = api;

// API documentation
var ramlSource = '';
var ramlHtml = '';

var logger = bedrock.loggers.get('app');

bedrock.events.on('bedrock-express.ready', function(app, callback) {
  var docs = require('./docs');
  var methods = ['get', 'post', 'put', 'patch', 'delete'];
  var serviceMap = {};

  // perform discovery on all of the endpoints
  _.each(methods, function(method) {
    _.each(app.routes[method], function(service) {
      var rawPath = service.path;
      var path = rawPath.replace(/(\:[a-zA-Z0-9]+)/g, function(v) {
        return '{' + v.replace(':', '') + '}';
      });

      if(!serviceMap.hasOwnProperty(path)) {
        serviceMap[path] = [];
      }

      serviceMap[path].push(service);
    });
  });

  // Remove default handlers and blacklisted endpoints
  delete serviceMap['*'];
  _.each(bedrock.config.website.docs.ignore, function(path) {
    var ignorePath = path.replace(/(\:[a-zA-Z0-9]+)/g, function(v) {
        return '{' + v.replace(':', '') + '}';
      });
    delete serviceMap[ignorePath];
  });

  // generate the base RAML source file by stiching together sections
  var sections = bedrock.config.website.docs.sections;
  // if true, RAML documentation sections have been started
  var docSectionsStarted = false;
  async.eachSeries(sections, function(section, callback) {
    var docPaths = bedrock.config.website.docs.paths;
    var docVars = bedrock.config.website.docs.vars;

    docs.loadFile(section, docPaths, docVars, function(err, data) {
      var sectionText = data;
      if(err) {
        return callback(err);
      }
      // if string ends with a '.md'
      if(section.indexOf('.md', section.length - 3) !== -1) {
        if(!docSectionsStarted) {
          ramlSource += 'documentation:\n';
          docSectionsStarted = true;
        }
        var sectionTitle = sectionText.match(/^#{1,6}\s(.*)\s$/m)[1];
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
  }, function(err) {
    if(err) {
      logger.error(
        'failed to load section of REST API documentation', {error: err});
      return callback();
    }
    _buildDocs(serviceMap, function(err) {
      if(err) {
        logger.error(
          'failed to build REST API documentation', {error: err});
      }
      callback();
    });
  });
});

// add routes
bedrock.events.on('bedrock-express.configure.routes', addRoutes);

function addRoutes(app) {
  app.get('/docs',
    function(req, res, next) {
    async.waterfall([
      function(callback) {
        bedrock.website.getDefaultViewVars(req, function(err, vars) {
          if(err) {
            return callback(err);
          }
         res.send(ramlHtml);
      });
    }], function(err) {
      if(err) {
        return next(err);
      }
    });
  });
}

/**
 * Builds the REST API documentation given a map of all URL endpoints served
 * by the system.
 *
 * @param serviceMap a URL map of all service endpoints for the system.
 * @param callback(err) called once the documentation has been built.
 */
function _buildDocs(serviceMap, callback) {
  var docs = require('./docs');
  var index = 0;
  var categoryMap = bedrock.config.website.docs.categories;
  var endpointKeys = _.union(_.keys(serviceMap), _.keys(categoryMap)).sort();

  async.eachSeries(endpointKeys, function(key, callback) {
    // find a parent path, if any
    var currentPath = null;
    var parentPath = '';
    for(var i = index - 1; i >= 0; i--) {
      if(key.indexOf(endpointKeys[i]) === 0) {
        parentPath = endpointKeys[i];
        currentPath = key.replace(endpointKeys[i], '');

        // if the current path doesn't start with a /, it was a false match
        if(currentPath[0] !== '/') {
          parentPath = '';
          currentPath = null;
        } else {
          i = 0;
        }
      }
    }
    index += 1;
    if(!currentPath) {
      currentPath = key;
    }

    // calculate the indent depth
    var indent = '';
    var depth = parentPath.split('/').length - 1;
    for(var j = 0; j < depth; j++) {
      indent += '  ';
    }

    // create the top-level documentation for the path
    ramlSource += indent + currentPath + ':\n';

    // check to see if this is a category
    if(categoryMap[key]) {
      ramlSource += indent + '  displayName: ' + categoryMap[key] + '\n';

      // go to next entry if purely a category
      if(!serviceMap[key]) {
        return callback();
      }
    }

    // add documentation for each HTTP method
    async.eachSeries(serviceMap[key], function(handler, callback) {
      docs.getRaml(
        handler.method, key, indent + '  ', function(err, ramlSnippet) {
        if(err) {
          logger.warning('no REST API documentation exists for ' + key);
          ramlSource += indent + '  ' + handler.method + ':\n' +
            indent + '    description: undocumented\n';
        }
        if(ramlSnippet) {
          ramlSource += ramlSnippet;
        }
        callback();
      });
    }, callback);

  }, function(err) {
    if(err) {
      return callback(err);
    }

    // build and cache the HTML documentation
    var ramlConfig = raml2html.getDefaultConfig(true);
    raml2html.render(ramlSource, ramlConfig, function(result) {
      ramlHtml = result;
    }, function(err) {
      logger.error(
        'failed to build REST API documentation', {error: err});
    });

    var fs = require('fs');
    fs.writeFile('/tmp/bedrock-api.raml', ramlSource);
    callback();
  });
}
