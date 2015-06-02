/**
 * Created by fugang on 15/1/6.
 */
var common = require('cloud/common');

AV.Cloud.define('getImTarget', function(req, res) {
    var users = req.params.users;
    users.sort();
    console.info('getImTarget users:', users);
    var querySession = new AV.Query('ImSession');
    querySession.equalTo('users', users);
    querySession.first().then(function(sessionResult){
        if (sessionResult) {
            return AV.Promise.as(sessionResult);
        } else {
            var SessionClass = common.extendClass('ImSession');
            var sessionClass = new SessionClass();
            sessionClass.set('users', users);
            return sessionClass.save();
        }
    }).then(function(sessionResult){
        res.success({targetId:sessionResult.id});
    }, function(error) {
        res.error(error);
    });
})