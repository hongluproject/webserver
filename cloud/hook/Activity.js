var common = require('cloud/common.js');
var myutils = require('cloud/utils');

AV.Cloud.afterSave('Activity', function(request) {
    var ActivityObj = request.object;
    var ActivityId = ActivityObj.id;
    var activityName = ActivityObj.get('title');
    var userObj = ActivityObj.get('user_id');
    ActivityObj.set('share_url', 'https://hoopeng.avosapps.com/activity/' + ActivityId);
    ActivityObj.save();

    //将活动发布者，自动加入聊天群组
    AV.Cloud.run('imAddToGroup',{
        userid:userObj.id,
        groupid:ActivityId,
        groupname:activityName
    });


});

AV.Cloud.afterUpdate('Activity', function(req){
    var activity = req.object;
    var activityId = req.object.id;
    var activityFounder = req.object.get('user_id');

    var query = new AV.Query('ActivityUser');
    query.select(500);
    query.select('user_id');
    query.find().then(function(results) {
        if (!results) {
            return;
        }

        var joinUsers = [];
        results.forEach(function(item){
            var user = item.get('user_id');
            joinUsers.push(user.id);
        });

        //通知到所有活动参与者，活动已经更新
        var query = new AV.Query('_User');
        query.containedIn('objectId', joinUsers);
        common.sendStatus('updateActivity', activityFounder, joinUsers, query, {activity:activity});
    });
});
