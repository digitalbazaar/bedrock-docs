# bedrock-docs ChangeLog

## 3.2.0 - 2019-10-11

### Changed
- Use raml2html@7.4.0.

## 3.1.0 - 2018-11-27

### Changed
- Update bedrock-validation peer dependency.

## 3.0.0 - 2018-09-17

### Changed
- Use bedrock-validation 3.x.

## 2.2.3 - 2018-06-27

### Fixed
- Use lodash `get` to avoid uncaught error during document retrieval.

## 2.2.2 - 2018-03-07

### Changes
- Update dependencies.

## 2.2.1 - 2018-01-18

### Fixed
- Namespace filenames with PID to prevent race condition.

## 2.2.0 - 2017-11-10

### Added
- RAML 1.0 support.

### Changed
- Use ES6 Syntax  
- Update raml2html dependency.
- Update async dependency.

### Fixed
- RAML rendering failure in cases where a route did not have a defined parent.
  Undefined parent endpoints are now defined automatically.

## 2.1.1 - 2017-07-27

### Changed
- Use child logger.

## 2.1.0 - 2017-05-04

### Changed
- Write error file when RAML compilation fails.

## 2.0.2 - 2016-08-28

### Changed
- Migrate doc configs to proper packages.

## 2.0.1 - 2016-03-15

### Changed
- Fix-up bedrock dependencies.

## 2.0.0 - 2016-03-02

### Changed
- Update package dependencies for npm v3 compatibility.

## 1.0.1 - 2015-05-07

## 1.0.0 - 2015-04-08

### Removed
- Some docs moved to READMEs in other modules.

## 0.1.1 - 2015-02-23

### Added
- Support for bedrock-express `0.2.x`.

## 0.1.0 - 2015-02-23

- See git history for changes.
