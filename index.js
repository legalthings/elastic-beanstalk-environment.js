module.exports = function(AWS, application, environment) {
  var inspect = require('util').inspect; 
  var extend = require('util')._extend;

  var elasticbeanstalk = new AWS.ElasticBeanstalk();
  var self = this;
  
  var updateMessage = {
    'fail': 'Update environment operation is complete, but with errors.',
    'success': 'Environment update completed successfully.'
  }
  
  // Public properties
  this.id = undefined;
  this.application = application;
  this.name = environment;
  this.url = undefined;
  this.description = undefined;
  this.platform = undefined;
  this.version = undefined;
  this.vars = {};
  this.status = undefined;
  this.health = undefined;
  this._requestId = undefined;
  this._https = false;
  
  function describeSettings(callback) {
    var params = {
      ApplicationName: application,
      EnvironmentName: environment
    };
    
    elasticbeanstalk.describeConfigurationSettings(params, function(err, data) {
      var info = {https: false, vars: {}};
      
      if (!err) {
        var options = data.ConfigurationSettings[0].OptionSettings;
        
        options.forEach(function(option) {
          if (option.Namespace === 'aws:elasticbeanstalk:application:environment') {
            info.vars[option.OptionName] = option.Value;
          }
          
          if (option.Namespace === 'aws:elb:loadbalancer' && option.OptionName === 'LoadBalancerHTTPSPort') {
            if (option.Value !== 'OFF') info.https = option.Value;
          }
        });
      }
      
      callback(err, info);
    });
  }
  
  function describeEnvironment(callback) {
    var params = {
      ApplicationName: application,
      EnvironmentNames: [environment],
      IncludeDeleted: false
    };
    
    elasticbeanstalk.describeEnvironments(params, function(err, data) {
      var info = !err ? data.Environments[0] : null;
      callback(err, info);
    });
  }
  
  function varsToOptions() {
    var settings = [];
    var remove = [];
  
    for (key in this.vars) {
      if (!vars[key] === undefined) continue;
      
      if (this.vars[key] !== null) {
        settings.push({
          Namespace: 'aws:elasticbeanstalk:application:environment',
          OptionName: key,
          Value: vars[key]
        });
      } else {
        remove.push({
          Namespace: 'aws:elasticbeanstalk:application:environment',
          OptionName: key
        });
      }
    }
    
    return {settings: settings, remove: remove};
  }
  
  function setInfo(info) {
    self.id = info.EnvironmentId;
    self.application = info.ApplicationName; // Should stay the same
    self.name = info.EnvironmentName; // Should stay the same
    self.description = info.Description;
    self.platform = info.SolutionStackName;
    self.version = info.VersionLabel;
    self.status = info.Status;
    self.health = info.Health;
    
    self.url = (self._https ? 'https://' : 'http://') + info.CNAME
      + (self._https && self._https !== 443 ? ':' + self._https : '');
      
    if (info.ResponseMetadata) self._requestId = info.ResponseMetadata.RequestId;
  }

  function load(callback) {
    var ds = {err: null, done: false};
    var de = {err: null, done: false};
  
    var done = function(type, err) {
      type.err = err;
      type.done = true;
      
      if (ds.done && de.done) {
        callback && callback(ds.err || de.err, self);
      }
    }
  
    describeSettings(function(err, info) {
      if (!err) {
        self.vars = info.vars;
        self._https = info.https;
        
        if (self.url) {
          self.url = (info.https ? 'https://' : 'http://')
            + self.url.replace(/^https?:\/\//, '').replace(/:\d+$/, '')
            + (info.https && info.https !== 443 ? ':' + info.https : '');
        }
      }
      
      done(ds, err);
    });
  
    describeEnvironment(function(err, info) {
      if (!err) setInfo(info);
      done(de, err);
    });
  }
  
  function update(callback) {
    var params = {
      EnvironmentName: environment
    };

    if (this.description !== undefined) params.Description = this.description;
    if (this.version !== undefined) params.VersionLabel = this.version;
    if (typeof this.config !== 'undefined') params.TemplateName = this.config;
    if (this.platform !== undefined) params.SolutionStackName = this.platform;
    
    var options = varsToOptions();
    params.OptionSettings = options.settings;
    params.OptionsToRemove = options.remove;
    
    if (Object.keys(params).length === 3 && Object.keys(this.vars).length === 0) {
      return callback("Nothing to update");
    }
    
    elasticbeanstalk.updateEnvironment(params, function(err, data) {
      if (err) return callback(err);
      
      setInfo(data);
      return callback();
    });
  }

  function wait(seconds, callback) {
    if (!this._requestId) return callback("No update performed");
    
    var params = {
      ApplicationName: application,
      EnvironmentName: environment,
      RequestId: this._requestId
    };
    
    var token;
    
    var done = function(err, result) {
      clearInterval(intervalToken);
      itToken = null;
      
      clearTimeout(timeoutToken);
      toToken = null;
      
      callback(err, result);
    }
    
    intervalToken = setInterval(function() {
      elasticbeanstalk.describeEvents(params, function(err, data) {
        if (err) return done(err, this);
        
        if (data.Events.length === 0) return;
        
        var event = data.Events[0];

        if (event.Message === updateMessage.fail) {
          return done(null, {success: false, message: event.Message});
        }
        
        if (event.Message === updateMessage.success) {
          describeEnvironment(function(err, info) {
            if (!err) setInfo(info);
            done(err, {success: true, message: event.Message});
          });
        }
      });
    }, 1000);
    
    timeoutToken = setTimeout(done, seconds * 1000);
  }
  
  // Public methods
  
  this.setVars = function(vars) {
    for (key in vars) {
      this.vars[key] = vars[key];
    }
  };
  
  this.load = load;
  this.update = update;  
  this.wait = wait;
  
  this.info = function() {
    var object = {};
    
    for (key in this) {
      if (!this.hasOwnProperty(key) || typeof this[key] === 'function') continue;
      if (key.substring(0, 1) !== '_') object[key] = this[key];
    }
    
    return object;
  };
}

