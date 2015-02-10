var common = require('cloud/common.js');

AV.Cloud.afterSave('Activity', function(request) {
    var ActivityObj = request.object;
    var ActivityId = ActivityObj.id;
    ActivityObj.set('share_url', 'https://hoopeng.avosapps.com/activity/' + ActivityId);
    ActivityObj.save();

    //加入者
    var commentUser = request.object.get('user_id');
    var ClanObj = request.object.get('clan_id');
    var queryClan = new AV.Query('Clan');
    queryClan.select('founder_id');
    queryClan.get(ClanObj.id, {
        success:function(clan) {
            var founderId = clan.get('founder_id').id;
            common.postRCMessage(commentUser.id,founderId,'加入了您发起的活动','joinActivity',ActivityId);
        }})
    //发起者
});