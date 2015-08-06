# eb-env.js

Show and update an ElasticBeanstalk environment from a node.js application or the command line.

## CLI

#### Installation

    npm install eb-env -g
   
#### Usage
   
    Usage: eb-env [options] [command]

    Commands:

      show [setting]                   Show environment setting(s) and status
      update [options] [KEY=VALUE...]  Update environment setting(s)

    Options:

      -h, --help                output usage information
      -V, --version             output the version number
      -q, --quiet               output fatal errors only
      --no-color                no colors for verbose output
      -r, --region [region]     AWS region
      --profile [profile]       AWS profile
      -a, --application [name]  Elastic Beanstalk application name
      -e, --environment [name]  Elastic Beanstalk environment name

If `--profile` is specified, a profile will be loaded from `~/.aws/credentials`.

The environment variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_SESSION_TOKEN`
may be used for authentication.

Alternatively the environment variable `AWS_REGION` may be used instead of `--region` and
`AWS_PROFILE` can be used instead of `--profile`

###### Show command
   
    Usage: eb-env show [options] [setting]

    Show environment setting(s) and status

    Options:

      -h, --help  output usage information

_Global options are also available._

###### Update command
   
    Usage: eb-env update [options] [KEY=VALUE...]

    Update environment setting(s)

    Options:

      -h, --help                   output usage information
      -w, --wait [seconds]         Wait max X seconds for the update to complete
      --version [label]            Deploy a version
      --description [description]  Change the environment description
      --config [template_name]     Change the environment configuration using a template
      --platform [name]            Change the platform (aka solution stack)
      --show                       Show environment after update

_Global options are also available._

#### Examples

    # Show environment settings
    eb-env -a my-eb-app -e some-env -r eu-west-1 show
    
    # Show a single environment setting
    eb-env -a my-eb-app -e some-env -r eu-west-1 show version
    
    # Show a single environment variable
    eb-env -a my-eb-app -e some-env -r eu-west-1 show vars.APPLICATION_ENV
    
    # Update the environment description
    eb-env -a my-eb-app -e some-env -r eu-west-1 update --description "A very nice description"
    
    # Update the environment version and the FOO env var.
    eb-env -a my-eb-app -e some-env -r eu-west-1 update --version 1.2.8 FOO=bar
    
    # Update the env vars and wait for completion (max 3 minutes)
    eb-env -a my-eb-app -e some-env -r eu-west-1 update FOO=bar QUX=bar --wait 180


## Library

#### Installation

    npm install eb-env --save
    
#### Load environment

```js
var AWS = require('aws-sdk');
var EBEnv = require('eb-env');

new EBEnv(AWS, 'my-eb-app', 'some-env').load(function(err, env) {
  if (err) throw err;
  
  process.stdout.write(env.name + ' running' + env.version + ' is ' + env.health + '\n');
  console.log(env.info());
});
```

#### Update environment

```js
var AWS = require('aws-sdk');
var EBEnv = require('eb-env');

var env = new EBEnv(AWS, 'my-eb-app', 'some-env');

env.version = '1.2.8';
env.description = 'A very nice description';
env.vars.FOO = 'bar';

env.update(function(err) {
  if (err) throw err;
  
  console.log('Updating ' + env.name);
  
  // Wait (max 3 minutes) for update to complete
  env.wait(function(180, function(err, result) {
    if (err) throw err;
    
    if (result) console.log(result.message);
  }))
});
```

