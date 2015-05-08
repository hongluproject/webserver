/**
 * Created by fugang on 14/12/22.
 */
var common = require('cloud/common.js');
var myutils = require('cloud/utils.js');
var querystring = require('querystring');
var _ = AV._;
var Promise = AV.Promise;

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
    if (!req.user) {
        res.error('您尚未登录!');
        return;
    }

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
    if (!req.user) {
        res.error('您尚未登录!');
        return;
    }

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
        activity:activity class object,
        news: News class object 部落里面最近的看吧文章
        extra:{
            hasJoined:bool 是否为该部落成员
        }
    }
 */
AV.Cloud.define('getClanDetail', function(req, res){
    var clanId = req.params.clanId;
    var userId = req.params.userId || (req.user && req.user.id);
    if (!clanId || !userId) {
        console.info('clan %s,userId %s', clanId, userId);
        res.error('请传入相关参数！');
        return;
    }
    var ret = {
        clan:{},
        extra:{},
        clanUsers:[],
        activity:{}
    };

    var retClan;
    var categoryIds;
    var queryClan = new AV.Query('Clan');
    queryClan.include('founder_id');
    queryClan.equalTo('objectId', clanId);
    queryClan.first().then(function(clan){
        var founder;
        if (clan) {
            retClan = clan;
            categoryIds = clan.get('clanCateIds');
            founder = clan.get('founder_id');
            clan = clan._toFullJSON();
            clan.founder_id = founder._toFullJSON();
            ret.clan = clan;

            if (founder.id != userId) {
                var clanIds = req.user && req.user.get('clanids');
                if (clanIds && _.indexOf(clanIds, clanId)>=0) {
                    ret.extra.hasJoined = true;
                }
            }
        }

        //查询部落成员
        var queryUsers = new AV.Query('ClanUser');
        queryUsers.select('user_id');
        queryUsers.include('user_id');
        queryUsers.equalTo('clan_id', AV.Object.createWithoutData('Clan', clanId));
        queryUsers.descending('createdAt');
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
        queryActivity.notEqualTo('removed', true);
        queryActivity.equalTo('allow_join_type', 2);    //活动归属于部落
        queryActivity.equalTo('allow_join_data', clanId);
        queryActivity.descending('createdAt');
        return queryActivity.first();
    }).then(function(activity){
        ret.activity = activity && activity._toFullJSON();

        //查询分类对应的名称，若部落没有分类，则用默认的分类代替
        if (common.isSahalaDevEnv()) {
            if (_.isEmpty(categoryIds)) {
                categoryIds = [];
                _.each(AV.HPGlobalParam.hpClanCategory, function(category){
                    categoryIds.push(category.id);
                });

                retClan.set('clanCateIds', categoryIds);
                retClan.save();
            }
        }

        return AV.Promise.as();
    }).then(function(results){
        //查询看吧里面最近的一篇文章
        var queryNews = new AV.Query('News');
        queryNews.greaterThan('from', 0);           //非系统抓取
        queryNews.equalTo('clanId', AV.Object.createWithoutData('Clan', clanId));       //该文章归属到该部落
        queryNews.equalTo('status', 1);             //处于上线状态
        queryNews.descending('publicAt');
        queryNews.select('-contents');
        return queryNews.first();
    }).then(function(result){
        ret.news = result && result._toFullJSON();

        res.success(ret);
    }, function(err){
        console.error(err);
    });
});

/*
    获取部落成员
    云函数：getClanUser (替换 imGetClanUser)
    参数：
        clanId:objectId 部落ID
        type: string   查询类别
                clanUser: 查询部落成员
                reviewClanUser: 查询申请加入该部落，待审核的成员
        skip:Integer  查询偏移
        limit:Integer 返回数量
    返回：[
            {
                user:ClanUser class object,
                extra:{
                    userTagNames:array  用户标签对应的名称
                    isFriend:bool 是否为好友
                }
            },
            ...
        ]
 */
AV.Cloud.define('getClanUser', function(req, res){
    var findFriendId = req.params.userId || (req.user && req.user.id);
    var clanId = req.params.clanId;
    var type = req.params.type || 'clanUser';
    var skip = req.params.skip || 0;
    var limit = req.params.limit || 20;
    if (!clanId) {
        res.error('请传入部落信息!');
        return;
    }

    var ret = [];
    var refClanUsers;
    //保留的user keys
    var pickUserKeys = ["objectId", "nickname", "className", "icon", "__type", 'sex', 'age', 'tags', 'friendCount',
                        'actual_position', 'normal_area', 'clanCount', 'noRemoveFromFriend'];
    var query;
    if (type == 'clanUser') {
        query = new AV.Query('ClanUser');
    } else if (type == 'reviewClanUser') {
        query = new AV.Query('ClanReviewUser');
    } else {
        res.error('请传入正确的查询类型!');
        return;
    }
    query.equalTo('clan_id', AV.Object.createWithoutData('Clan', clanId));
    query.skip(skip);
    query.limit(limit);
    query.include('user_id');
    query.find().then(function(clanUsers){
        refClanUsers = clanUsers;
        var users = [];
        _.each(clanUsers, function(clanUser){
            users.push(clanUser.get('user_id'));
        });

        return common.getFriendshipUsers(findFriendId, users);
    }).then(function(friendObj){
        _.each(refClanUsers, function(userItem) {
            var user = userItem.get('user_id');
            var tags = user.get('tags');
            userItem.unset('founder_userinfo');

            userItem = userItem._toFullJSON();
            userItem.user_id = _.pick(user._toFullJSON(), pickUserKeys);
            ret.push({
                user:userItem,
                extra:{
                    userTagNames:common.tagNameFromId(tags),
                    isFriend:friendObj[user.id]?true:false
                }
            });
        });

        res.success(ret);
    }, function(err){
        res.error('查询失败,错误码:'+err.code);
    });
})

/*
    部落看吧文章置顶
    函数名：
        bringNewsToTop
    参数：
        newsId      资讯ID
        clanId      部落ID
        categoryId  分类ID
    返回：
        success or fail
 */
AV.Cloud.define('bringNewsToTop', function(req, res){
    var newsId = req.params.newsId;
    var clanId = req.params.clanId;
    var categoryId = req.params.categoryId;
    if (!newsId || !clanId || !categoryId) {
        res.error('请传入相关信息!');
        return;
    }

    var query = new AV.Query('News');
    query.select('rank');
    query.equalTo('clanId', AV.Object.createWithoutData('Clan', clanId));
    query.equalTo('clanCateId', AV.Object.createWithoutData('ClanCategory', categoryId));
    query.descending('rank');
    query.addDescending('publicAt');
    query.first().then(function(result){
        var maxRank = (result&&result.get('rank')) || 0;
        var findNewsId = result&&result.id;

        if (newsId != findNewsId) {
            var targetNews = AV.Object.createWithoutData('News', newsId);
            targetNews.set('rank', (maxRank+1));
            return targetNews.save();
        } else {
            return AV.Promise.as();
        }
    }).then(function(result){
        res.success();
    }, function(err){
        console.error('文章置顶失败：', err);
        res.error('文章置顶失败,错误码:' + err.code);
    });
});

/*
    获取看吧文章列表
    函数名：
        getClanBarList
    参数：
        userId          当前用户ID
        clanId          部落ID
        categoryId      分类ID
        skip、limit      分页查询参数
    返回：[
            {
                news: News class object,
                extra:{
                    tagNames: array 对应资讯标签名称
                    isLike: bool    该用户是否点赞过
                    like: Like class object 对应的点赞对象，若有该对象，则表示用户点赞过
                }
            },
            ...
    ]

 */
AV.Cloud.define('getClanBarList', function(req, res){
    var userId = req.params.userId || (req.user&&req.user.id);
    var clanId = req.params.clanId;
    var categoryId = req.params.categoryId;
    var skip = req.params.skip || 0;
    var limit = req.params.limit || 20;
    var allNews;
    if (!clanId || !categoryId) {
        res.error('请传入相关参数!');
        return;
    }

    var query = new AV.Query('News');
    query.select('-contents');
    query.equalTo('clanId', AV.Object.createWithoutData('Clan', clanId));
    query.equalTo('clanCateId', AV.Object.createWithoutData('ClanCategory', categoryId));
    query.equalTo('status', 1);
    query.descending('rank');
    query.addDescending('publicAt');
    query.skip(skip);
    query.limit(limit);
    query.find().then(function(results){
        allNews = results;

        var newsIds = [];
        _.each(results, function(newsItem){
            newsIds.push(newsItem.id);
        });

        if (_.isEmpty(newsIds)) {
            return AV.Promise.as();
        } else {
            query = new AV.Query('Like');
            query.equalTo('like_type', 1);
            query.containedIn('external_id', newsIds);
            query.equalTo('user_id', AV.User.createWithoutData('_User', userId));
            return query.find();
        }
    }).then(function(likes){
        var likeObj = {};
        _.each(likes, function(likeItem){
           likeObj[likeItem.get('external_id')] = likeItem;
        });

        var ret = [];
        _.each(allNews, function(newsItem){
            ret.push({
                news:newsItem._toFullJSON(),
                extra:{
                    tagNames:common.tagNameFromId(newsItem.get('tags')),
                    isLike:likeObj[newsItem.id]?true:false,
                    like:likeObj[newsItem.id]?newsItem._toFullJSON():undefined
                }
            });
        });

        res.success(ret);
    }, function(err){
        console.error(err);
    });
});

/*
    删除看吧文章
    函数名：
        deleteClanBarNews
    参数：
        newsId： 资讯ID
    返回：
        success or fail
 */
AV.Cloud.define('deleteClanBarNews', function(req, res){
    var userId = req.params.userId || (req.user&&req.user.id);
    var newsId = req.params.newsId;

    var newsObj = AV.Object.createWithoutData('News', newsId);
    newsObj.set('status', 2);
    newsObj.save().then(function(){
       res.success();
    }, function(err){
        res.error('删除失败，错误码:'+err.code);
    });
});

/*
    保存更新的分类名称
    函数名:
        saveCategory
    参数：
        clanId:objectId     部落ID
        categoryNames:array 保存的所有分类名称
        hideCategoryNames:array 需要隐藏的分类名称
    返回：
        [
            {
                category:ClanCategory class object,
                extra:{
                    visible:true or false,默认为true
                }
            }
            ...
        ]
 */
AV.Cloud.define('saveCategory', function(req, res){
    var clanId = req.params.clanId;
    var categoryNames = req.params.categoryNames;
    var hideCategoryNames = req.params.hideCategoryNames;

    var categoryObj = {};   //key:name value:category class object
    var hideCateObj = {};   //key:name value:true

    _.each(hideCategoryNames, function(cateName){
        hideCateObj[cateName] = true;
    })

    var query = new AV.Query('ClanCategory');
    query.containedIn('cateName', categoryNames);
    query.find().then(function(results){
        var findCategoryNames = [];
        _.each(results, function(categoryItem){
            var cateName = categoryItem.get('cateName');
            findCategoryNames.push(cateName);
            categoryObj[cateName] = categoryItem;
        });

        //找到尚未注册的名称，并为之注册
        var unregisterCateNames = _.difference(categoryNames, findCategoryNames);
        var promises = [];
        _.each(unregisterCateNames, function(cateName){
            var ClanCategory = AV.Object.extend('ClanCategory');
            var clanCategory = new ClanCategory();
            clanCategory.set('cateName', cateName);
            promises.push(clanCategory.save());
        });

        return Promise.all(promises);
    }).then(function(results){
        //every name has been saved
        _.each(results, function(result){
            var cateName = result.get('cateName');
            categoryObj[cateName] = result;
        });

        var rets = [];
        var clanCategoryIds = [], hideClanCategoryIds = [];
        _.each(categoryNames, function(cateName){
            var clanCategory = categoryObj[cateName];
            if (clanCategory) {
                rets.push({
                        category:clanCategory._toFullJSON(),
                        extra:{
                            visible:hideCateObj[cateName]?false:true
                        }
                    });
                clanCategoryIds.push(clanCategory.id);
                if (hideCateObj[cateName]) {
                    hideClanCategoryIds.push(clanCategory.id);
                }
            }
        });

        //保存到部落里面去
        var Clan = AV.Object.extend('Clan');
        var clan = new Clan();
        clan.id = clanId;
        clan.set('clanCateIds', clanCategoryIds);
        clan.set('hideCateIds', hideClanCategoryIds);
        clan.save().then(function(result){
            res.success(rets);
        });

    }).catch(function(err){
        console.error('保存分类失败:', err);
        res.error('保存分类失败，错误码:'+err.code);
    });
});

/*
    获取部落分类列表
    函数名:
        getClanCategory
    参数:
        clanId:objectId 部落ID
    返回:
    [
        {
            category: ClanCategory class object
            extra:{
                visible:true or false,默认为true
            }
        }
    ]
 */
AV.Cloud.define('getClanCategory', function(req, res){
    var clanId = req.params.clanId;
    if (!clanId) {
        res.error('请传入部落信息!');
        return;
    }

    var clanCateIds = [], hideCateIds = [];
    var clanCateObj = {}, hideCateObj = {};
    var query = new AV.Query('Clan');
    query.select('clanCateIds', 'hideCateIds');
    query.get(clanId).then(function(clan){
        if (!clan) {
            return AV.Promise.error(new AV.Error(-1, '部落不存在!'));
        }

        clanCateIds = clan.get('clanCateIds') || [];
        hideCateIds = clan.get('hideCateIds') || [];

        _.each(hideCateIds, function(clanCateId){
            hideCateObj[clanCateId] = true;
        });

        query = new AV.Query('ClanCategory');
        query.containedIn('objectId', clanCateIds);
        return query.find();
    }).then(function(clanCates){
        _.each(clanCates, function(clanCate){
            var clanCateId = clanCate.id;
            clanCateObj[clanCateId] = clanCate;
        });

        var ret = [];
        _.each(clanCateIds, function(clanCateId){
            var clanCate = clanCateObj[clanCateId];
            if (clanCate) {
                ret.push({
                        category:clanCate._toFullJSON(),
                        extra:{
                            visible:hideCateObj[clanCateId]?false:true
                        }
                });
            }
        });

        res.success(ret);
    }).catch(function(err){
        if (err.code > 0) {
            res.error('获取分类列表失败，错误码:'+err.code);
        } else {
            res.error(err.message);
        }
    });
});

