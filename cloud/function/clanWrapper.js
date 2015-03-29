/**
 * Created by fugang on 14/12/22.
 */
var common = require('cloud/common.js');

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

        var clanParam = common.clanParam;
        var createdClanIds = userResult.get('createdClanIds');
        var currClanNum = createdClanIds?createdClanIds.length:0;
        var userLevel = userResult.get('level');

        var nMaxCreateClan = clanParam.getMaxCreateClan(userLevel);
        var nMaxClanUsers = clanParam.getMaxClanUsers(userLevel);

        console.info('current createdClan num %d,max createdClan num %d', currClanNum, nMaxCreateClan);

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

/*
    查询用户参与的部落（包含自己创建和加入的）
    函数名：getClanJoined
    参数：
        无
    返回：
    [
        {clan 1},
        {clan 2}
    ]
 */
AV.Cloud.define('getClanJoined', function(req, res){
    var userId = req.user && req.user.id;
    if (!userId) {
        res.error('未传入用户信息');
        return;
    }

    var _ = AV._;
    //保留的clan keys
    var pickClanKeys = ['objectId','__type', 'title', "className"];
    var query = new AV.Query('ClanUser');
    query.select('clan_id');
    query.include('clan_id');
    query.equalTo('user_id', AV.User.createWithoutData('_User', userId));
    query.descending('user_level');
    query.limit(100);
    query.find().then(function(clans){
        if (!clans) {
            res.success([]);
            return;
        }

        var retClans = [];
        clans.forEach(function(clan){
           var clanObj = clan.get('clan_id');

            retClans.push(_.pick(clanObj._toFullJSON(), pickClanKeys));
        });

        res.success(retClans);
    }, function(err){
        res.error('查询部落失败:'+err?err.message:'');
    })
});