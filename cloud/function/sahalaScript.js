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
    var option = req.params.option;
    var optionId = req.params.optionId;
    var userId =  req.params.userId;
    if (!option||!optionId||!userId) {
        res.error('亲亲参数输入错误了');
        return;
    }
    var rand6Number =   function s6(){
        var result = '';
        var data = [0,1,2,3,4,5,6,7,8,9,'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
        for(var i=0;i<6;i++){ //产生20位就使i<20
            r=Math.floor(Math.random()*62); //16为数组里面数据的数量，目的是以此当下标取数组data里的值！
            result+=data[r]; //输出20次随机数的同时，让rrr加20次，就是20位的随机字符串了。
        }
        return result;
    }

    var randNumber =  rand6Number();
    var InvitationCode = AV.Object.extend("InvitationCode");
    var invitationCode = new InvitationCode();
    invitationCode.set("userId", AV.Object.createWithoutData("_User", userId, false));
    invitationCode.set("invitationCode", randNumber);
   if(option == 1){
       invitationCode.set("clanId", AV.Object.createWithoutData("Clan", optionId, false));
       invitationCode.set("option", 1);
       invitationCode.save(null, {
           success: function () {
               res.success({
                   invitationCode:randNumber
               });
           },
           error: function () {
               res.error('亲亲又报错了');
           }
       });
   }else if(option == 2){
       invitationCode.set("activityId", AV.Object.createWithoutData("Activity", optionId, false));
       invitationCode.set("option", 2);
       invitationCode.save(null, {
           success: function () {
               res.success({
                   invitationCode:randNumber
               });
           },
           error: function () {
               res.error('亲亲又报错了');
           }
       });
   }
});


AV.Cloud.define('validateInvitationCode', function(req, res){
    var invitationCode = req.params.invitationCode;
    var InvitationCode = AV.Object.extend("InvitationCode");
    var query = new AV.Query(InvitationCode);
    query.equalTo("invitationCode",invitationCode);

    //一周内
    var today=new Date();
    var t=today.getTime()-1000*60*60*24*7;
    var searchDate=new Date(t);
    query.greaterThan('createdAt',searchDate);
    query.descending("createdAt");
    query.first({
        success: function(object) {
            if(object){
                res.success({
                    invitationCodeStatus:true
                });
            }else{
                res.success({
                    invitationCodeStatus:false
                });
            }
        },
        error: function(error) {
            res.success({
                invitationCodeStatus:false
            });
        }
    });

});




AV.Cloud.define('getInvitationInfo', function(req, res){
    var invitationCode = req.params.invitationCode;
    var InvitationCode = AV.Object.extend("InvitationCode");
    var query = new AV.Query(InvitationCode);
    query.equalTo("invitationCode",invitationCode);
    //一周内
    var today=new Date();
    var t=today.getTime()-1000*60*60*24*7;
    var searchDate=new Date(t);
    query.greaterThan('createdAt',searchDate);
    query.descending("createdAt");
    query.first({
        success: function(object) {
            if(object){
                var optionId = null;
                if(object.get('option') == 1){
                    optionId =  object.get('clanId').id;
                }else{
                    optionId =  object.get('activityId').id;
                }
                res.success({
                     "option":object.get('option'),
                     "optionId":optionId
                });
            }else{
                res.error('error');
            }
        },
        error: function(error) {
            res.error('error');
        }
    });



});



