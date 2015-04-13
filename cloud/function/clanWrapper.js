/**
 * Created by fugang on 14/12/22.
 */
var common = require('cloud/common.js');
var myutils = require('cloud/utils.js');
var querystring = require('querystring');
var _ = AV._;

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
        res.error('查询部落失败,错误码:'+err.code);
    })
});

/*
    部落信息更新
    云函数：clanUpdate
    参数：
        clanId:objectId 部落ID
        clanName:string 部落名称
    返回：
        success or error
 */
AV.Cloud.define('clanUpdate', function(req, res){
    var clanId = req.params.clanId;
    var clanName = req.params.clanName;
    if (!clanId || !clanName) {
        res.error('请传入参数！');
        return;
    }

    //如果名称发生变更，将对应融云保存的群组名称也同步更新
    var rcParam = myutils.getRongCloudParam();
    console.info("clanUpdate:nonce:%d timestamp:%d singature:%s",
        rcParam.nonce, rcParam.timestamp, rcParam.signature);
    var reqBody = {
        groupId:clanId,
        groupName:clanName
    };
    //通过avcloud发送HTTP的post请求
    AV.Cloud.httpRequest({
        method: 'POST',
        url: 'https://api.cn.rong.io/group/refresh.json',
        headers: {
            'App-Key': rcParam.appKey,
            'Nonce': rcParam.nonce,
            'Timestamp': rcParam.timestamp,
            'Signature': rcParam.signature
        },
        body: querystring.stringify(reqBody),
        success: function(httpResponse) {
            console.info('clanUpdate:rongcloud response is '+httpResponse.text);
        },
        error: function(httpResponse) {
            var errmsg = 'Request failed with response code ' + httpResponse.status;
            console.error('clanUpdate:'+errmsg);
        }
    });

    res.success();
});

/*
    用户信息更新：
    云函数：userUpdate
    参数：
        userId:objectId 用户ID
        userName:string 用户昵称
        userIcon:string 用户头像
    返回：
        success or error
 */
AV.Cloud.define('userUpdate', function(req, res){
    var userId = req.params.userId;
    var userName = req.params.userName;
    var userIcon = req.params.userIcon;

    if (!userId || !userName) {
        res.error('请传入参数！');
        return;
    }

    //如果名称发生变更，将对应融云保存的群组名称也同步更新
    var rcParam = myutils.getRongCloudParam();
    console.info("userUpdate:nonce:%d timestamp:%d singature:%s",
        rcParam.nonce, rcParam.timestamp, rcParam.signature);
    var reqBody = {
        userId:userId,
        name:userName,
        portraitUri:userIcon
    };
    //通过avcloud发送HTTP的post请求
    AV.Cloud.httpRequest({
        method: 'POST',
        url: 'https://api.cn.rong.io/user/refresh.json',
        headers: {
            'App-Key': rcParam.appKey,
            'Nonce': rcParam.nonce,
            'Timestamp': rcParam.timestamp,
            'Signature': rcParam.signature
        },
        body: querystring.stringify(reqBody),
        success: function(httpResponse) {
            console.info('userUpdate:rongcloud response is '+httpResponse.text);
        },
        error: function(httpResponse) {
            var errmsg = 'Request failed with response code ' + httpResponse.status;
            console.error('userUpdate:'+errmsg);
        }
    });

    res.success();
});

/*
    获取部落详情
    函数名:
        getClanDetail
    参数：
        clanId:objectId 部落ID
        userId:objectId 当前用户ID
    返回：{
        clan:clan class object
        clanUsers: [
            user class object,
            ...
        ],
        activity:activity class object
    }
 */
AV.Cloud.define('getClanDetail', function(req, res){
    var clanId = req.params.clanId;
    var userId = req.params.userId || (req.user && req.user.id);
    if (!clanId || !userId) {
        res.error('请传入相关参数！');
        return;
    }
    var ret = {
        clan:{},
        clanUsers:[],
        activity:{}
    };

    var queryClan = new AV.Query('Clan');
    queryClan.include('founder_id');
    queryClan.equalTo('objectId', clanId);
    queryClan.first().then(function(clan){
        var founder;
        if (clan) {
            founder = clan.get('founder_id');
            clan = clan._toFullJSON();
            clan.founder_id = founder._toFullJSON();
            ret.clan = clan;
        }

        //查询部落成员
        var queryUsers = new AV.Query('ClanUser');
        queryUsers.select('user_id');
        queryUsers.include('user_id');
        queryUsers.equalTo('clan_id', AV.Object.createWithoutData('Clan', clanId));
        if (founder) {
            queryUsers.notEqualTo('user_id', founder);
        }
        queryUsers.limit(10);
        return queryUsers.find();
    }).then(function(users){
        //保留的user keys
        var pickUserKeys = ["objectId", "username", "nickname", "className", "icon", "__type"];
        _.each(users, function(userItem){
            var user = userItem.get('user_id');
            ret.clanUsers.push(_.pick(user._toFullJSON(), pickUserKeys));
        });

        //查询该部落最近一次的活动
        var queryActivity = new AV.Query('Activity');
        queryActivity.limit(1);
        queryActivity.equalTo('clan_id', AV.Object.createWithoutData('Clan', clanId));
        queryActivity.descending('createdAt');
        return queryActivity.first();
    }).then(function(activity){
        ret.activity = activity && activity._toFullJSON();

        res.success(ret);
    });
});