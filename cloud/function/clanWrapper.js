/**
 * Created by fugang on 14/12/22.
 */

var clanParam = require('cloud/common.js').clanParam;

/** 判断用户是否可创建部落
 *
 */
AV.Cloud.define('canCreateClan', function(req, res) {
    var userId = req.params.userId;
    if (!userId) {
        res.error('缺少用户信息！');
        return;
    }

    //查询用户已经创建的部落数
    var queryUser = new AV.Query('_User');
    queryUser.get(userId).then(function(userResult) {
        if (!userResult) {
            console.error('get user error:%s', userId);
            res.error('未查到用户信息!');
            return;
        }

        var createdClanIds = userResult.get('createdClanIds');
        var currClanNum = createdClanIds?createdClanIds.length:0;
        var userLevel = userResult.get('level');
        var nMaxCreateClan = clanParam.maxCreateClan[userLevel] || 2;
        var nMaxClanUsers = clanParam.maxClanUsers[userLevel] || 10;

        console.info('current createdClan num %d,max createdClan num%d', currClanNum, nMaxCreateClan);

        if (currClanNum >= nMaxCreateClan) {  //如果超过所能创建的上限，则禁止创建
            res.success({
                canCreate:false,
                maxCreateClan:nMaxCreateClan,
                canCreateClan:nMaxCreateClan-currClanNum,
                maxClanUsers:nMaxClanUsers
            });
        } else {
            res.success({
                canCreate:true,
                maxCreateClan:nMaxCreateClan,
                canCreateClan:nMaxCreateClan-currClanNum,
                maxClanUsers:nMaxClanUsers
            });
        }
    }, function(error) {
        console.error('get user error:%s ', userId, error);
        res.error('查询用户信息失败!');
    });
});