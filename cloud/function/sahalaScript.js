/**
 * Created by fugang on 15/1/17.
 */
var common = require('cloud/common.js');

/** 更新部落信息，同步部落最大数，是否满员等信息
 *
 */
AV.Cloud.define('updateClanParam', function(req, res){
    //批量脚本：修改部落最大成员数
    var clanId = req.params.clanId;
    var queryClan = new AV.Query('Clan');
    queryClan.include('founder_id');
    if (clanId) {
        queryClan.equalTo('objectId', clanId);
    }
    queryClan.find().then(function(results){
        for (var i in results) {
            var userLevel = results[i].get('founder_id').get('level');
            var maxClanUsers = common.clanParam.getMaxClanUsers(userLevel);
            var currClanUsers = results[i].get('current_num');
            results[i].set('max_num', maxClanUsers);
            results[i].set('is_full', currClanUsers>=maxClanUsers);
            results[i].save();
        }
        res.success();
    });
});

AV.Cloud.define('updateClanForRC', function(req, res){
    var userId = req.params.userId;
    var updateType = req.params.updateType || 1;    //1:添加 2:删除
    var queryClanUser = new AV.Query('ClanUser');
    queryClanUser.include('clan_id');
    queryClanUser.limit(1000);
    if (userId) {
        queryClanUser.equalTo('user_id', AV.User.createWithoutData('_User',userId));
    }
    queryClanUser.find().then(function(results){
        results.forEach(function(clanUser){
            var userObj = clanUser.get('user_id');
            var clanObj = clanUser.get('clan_id');
            if (!userObj || !clanObj) {
                return;
            }
            //加入融云组群
            AV.Cloud.run('imAddToGroup',{
                userid:userObj.id,
                groupid:clanObj.id,
                groupname:clanObj.get('title')
            });
        });
        res.success(results);
    });
});




AV.Cloud.define('getInvitationCode', function(req, res){
    //option   操作
    //activityId
    //userId
    //生成邀请码
    var rand6Number =   function s6(){
        var result = '';
        var data = [0,1,2,3,4,5,6,7,8,9,'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
        for(var i=0;i<6;i++){ //产生20位就使i<20
            r=Math.floor(Math.random()*62); //16为数组里面数据的数量，目的是以此当下标取数组data里的值！
            result+=data[r]; //输出20次随机数的同时，让rrr加20次，就是20位的随机字符串了。
        }
        return result;
    }

    res.success({
        code:rand6Number()
    });


});





AV.Cloud.define('validateInvitationCode', function(req, res){
    //option   操作
    //activityId
    //userId
    //生成邀请码

    res.success({
        status:true
    });

});