/**
 * Created by fugang on 14/12/22.
 */

var clanParam = require('cloud/common.js').clanParam;

/** 判断用户是否可创建部落
 *
 */
AV.Cloud.define('canCreateClan', function(req, res) {
    var userId = req.object.userId;
    if (!userId) {
        res.error('缺少用户信息！');
        return;
    }

    //查询用户已经创建的部落数
    var queryUser = AV.Query('_User');
    queryUser.get(userId).then(function(userResult) {
        if (!userResult) {
            console.error('get user error:%s', userId);
            res.error('未查到用户信息!');
            return;
        }

        var createdClanIds = userResult.get('createdClanIds');
        var userLevel = userResult.get('level');
        var nMaxCreateClan = clanParam.maxCreateClan[userLevel] || 2;

        console.info('current createdClan num %d,max createdClan num%d', createdClanIds.length, nMaxCreateClan);

        if (createdClanIds.length >= nMaxCreateClan) {  //如果超过所能创建的上限，则禁止创建
            res.success({
                canCreate:false,
                maxCreateClan:nMaxCreateClan
            });
        } else {
            res.success({
                canCreate:true,
                maxCreateClan:nMaxCreateClan
            });
        }
    }, function(error) {
        console.error('get user error:%s ', userId, error);
        res.error('查询用户信息失败!');
    });
});