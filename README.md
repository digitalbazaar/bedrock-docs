# bedrock-docs

A [bedrock][] module that adds custom documentation and REST API documentation
support to a site. Documentation is hosted at `/docs`. API documentation can be
generated with [RAML][] and [raml2html][] by using the documentation API to
annotate REST endpoints.

## Requirements

- npm v3+

## Quick Examples

```
npm install bedrock-docs
```

```js
var brDocs = require('bedrock-docs');

bedrock.events.on('bedrock-express.configure.routes', addRoutes);

function addRoutes(app) {
  app.get('/my/resource', function(req, res, next) {
    // ...
  });
  brDocs.annotate.get('/my/resource', {
    displayName: 'My Resource',
    description: 'Get My Resource.',
    responses: {
      200: {
        'application/ld+json': {
          'example': 'examples/my-resource.jsonld'
        }
      }
    }
  });
}
```

## Configuration

For documentation on configuration, see [config.js](./lib/config.js).

## API

### getRaml(method, path, indent, callback(err, ramlSnippet))

Retrieve a RAML annotation for a particular method and path. The indentation
level must be provided. Use '{' and '}' for path variables ("/my/{id}"). The
result RAML string can be injected into a master RAML file.

### loadFile(section, paths, vars, callback)

Loads a documentation file from disk, making the appropriate template
replacements.

### document(method, path, doc)

Documents a particular method and path of the system. Prefix path variables
with ':' ("/my/:id"). The `doc` object is in [RAML][] format.

### annotate.METHOD(path, docs)

Aliases for `document(METHOD, path, doc)` for `get`, `post`, `put`, `patch`,
and `delete`.

[bedrock]: https://github.com/digitalbazaar/bedrock
[RAML]: http://raml.org/
[raml2html]: https://github.com/kevinrenskers/raml2html
