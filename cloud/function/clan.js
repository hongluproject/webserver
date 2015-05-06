var clanParam = require('cloud/common.js').clanParam;
var myutils = require('cloud/utils.js');
var common = require('cloud/common.js');
var _ = AV._;

/*
    用户部落，所加入的部落，以及推荐的部落
    函数名：getClan2
    参数：
        userId:用户ID
        tags:用户标签
        type:
            joined: 我加入的部落
            recommend: 推荐的部落
            self:我创建的部落
            mine:我加入和我创建的部落
        skip,limit:翻页查询参数
    返回：
        [
        {
            clan: clan class object,
            extra:{
                tagNames: array 标签名称，对应 clan里面tags的名称
                clanType:
                        0:未知
                        1:我创建的部落
                        2:我加入的部落
            }
        },
        ...
    ]
*/
AV.Cloud.define('getClan2', function(req, res){
    var userId = req.params.userId || (req.user && req.user.id);
    if (!userId) {
        res.error('请传入用户信息！');
        return;
    }
    var tagsOfUser = req.params.tags || (req.user && req.user.get('tags'));
    var HPGlobalParam = AV.HPGlobalParam || {};
    var retVal = [];

    var user = req.user;
    if (!user) {
        res.error('用户登陆信息丢失！');
        return;
    }
    var type = req.params.type || 'mine';
    var createdClanIds = user.get('createdClanIds');
    var clanIds = user.get('clanids') || [];
    var reviewClanIds = user.get('review_clanids') || [];
    var skip = req.params.skip || 0;
    var limit = req.params.limit || 20;

    var formatResult = function(clans, bGetClanType) {
        var retClan = [];

        //保留的user keys
        var pickUserKeys = ["objectId", "username", "nickname", "className", "icon", "__type"];
        _.each(clans, function(clanItem){
            var founder = clanItem.get('founder_id');
            var tagsOfClan = clanItem.get('tags');
            clanItem.unset('founder_userinfo');

            clanItem = clanItem._toFullJSON();
            clanItem.founder_id = _.pick(founder._toFullJSON(), pickUserKeys);

            var retItem = {
                clan:clanItem,
                extra:{
                    tagNames:common.tagNameFromId(tagsOfClan)
                }
            }
            if (bGetClanType) {
                //区分我创建的部落、和我加入的部落
                retItem.extra.clanType = ((founder.id==userId)?1:2);
            }
            retClan.push(retItem);
        });

        return retClan;
    }

    switch (type) {
        case 'mine':
            if (_.isEmpty(clanIds)){
                res.success([]);
                return;
            }
            var query = new AV.Query('Clan');
            query.containedIn('objectId', clanIds);
            query.skip(skip);
            query.limit(limit);
            query.find().then(function(clans){
                retVal = formatResult(clans, true);
                res.success(retVal);
            });
            break;

        case 'joined':
            if (_.isEmpty(clanIds)) {
                res.success(retVal);
                return;
            }
            var joinedClanIds = _.difference(clanIds, createdClanIds);
            if (_.isEmpty(joinedClanIds)) {
                res.success(retVal);
                return;
            }
            var query = new AV.Query('Clan');
            query.containedIn('objectId', joinedClanIds);
            query.skip(skip);
            query.limit(limit);
            query.find().then(function(clans){
                retVal = formatResult(clans);
                res.success(retVal);
            });
            break;

        case 'self':
            if (_.isEmpty(createdClanIds)) {
                res.success(retVal);
                return;
            }
            var query = new AV.Query('Clan');
            query.containedIn('objectId', createdClanIds);
            query.skip(skip);
            query.limit(limit);
            query.find().then(function(clans){
                retVal = formatResult(clans);
                res.success(retVal);
            });
            break;

        case 'recommend':
            var reviewClanIds = user.get('review_clanids');
            var userGeoPoint = user.get('actual_position');
            var arrClanIds = [];

            //先按照标签推荐部落
            var queryOr = [];
            _.each(tagsOfUser, function(tag){
                var query = new AV.Query("Clan");
                query.equalTo('tags', tag);
                query.exists('tags');
                queryOr.push(query);
            });

            var query = AV.Query.or.apply(null, queryOr);
            arrClanIds = arrClanIds.concat(clanIds).concat(reviewClanIds);
            if(arrClanIds.length){
                query.notContainedIn("objectId", arrClanIds);
            }
            if (userGeoPoint) {
                query.near("position", userGeoPoint);
            }
            query.equalTo("is_full", false);
            query.limit(limit);
            query.skip(skip);
            query.find().then(function(clans){
              if (_.isEmpty(clans) && !skip){
                  //若没有按照随机标签找到部落，则按地理位置推荐就近的部落
                  var query = new AV.Query('Clan');
                  if (arrClanIds) {
                      query.notContainedIn('objectId', arrClanIds);
                  }
                  if (userGeoPoint) {
                      query.near("position", userGeoPoint);
                  }
                  query.include('founder_id');
                  query.equalTo("is_full", false);
                  query.limit(limit);
                  query.skip(skip);
                  return query.find();
              } else {
                  return AV.Promise.as(clans);
              }
            }).then(function(clans){
                retVal = formatResult(clans);

                res.success(retVal);
            }, function(err){
                console.error(err);
            });

            return;

        default:
            res.error('位置查询类型！');
            return;
    }

});

AV.Cloud.define("getClan",function(req, res){
    var HPGlobalParam = AV.HPGlobalParam || {};
    var userid = req.params.userid;
    var tags = req.params.tags||[];
    var index = Math.floor((Math.random()*tags.length));
    var User = AV.Object.extend("_User");
    var Clan = AV.Object.extend("Clan");
    var userInfo = null;
    var ret = {
        selfClan:{},
        recommendClan:{}
    };
    //保留的user keys
    var pickUserKeys = ["objectId", "username", "nickname", "className", "icon", "__type"];

    console.info('getClan params, userid:%s', userid);

    var getSelfClan = function(userid){
        var query = new AV.Query(User);
        query.select("nickname","tags","clanids","actual_position",'level','review_clanids');
        query.get(userid).then(function(result) {
            userInfo =  result;
            var  clanids = result.get("clanids");
            var review_clanids = result.get("review_clanids");
            userLevel = result.get('level');
            if(clanids){
                var query = new AV.Query(Clan);
                query.containedIn("objectId",clanids);
                query.include('founder_id');
                query.find({
                    success: function(result) {
                        var userClan = [];
                        for (var i = 0; i < result.length; i++) {
                            var outResult = {};
                            var arrayTagName = [];
                            var arrayTag = result[i].get('tags');
                            for (var k in arrayTag) {
                                var name = '';
                                if (HPGlobalParam.hpTags[arrayTag[k]]) {
                                    name = HPGlobalParam.hpTags[arrayTag[k]].get('tag_name');
                                }
                                arrayTagName.push(name);
                            }
                            if (arrayTagName.length) {
                                result[i].set('tagsName', arrayTagName);
                            }

                            var founderObj = result[i].get('founder_id');
                            result[i].set('founder_id', _.pick(founderObj._toFullJSON(), pickUserKeys));
                            result[i].set('founder_userinfo', {
                                icon:founderObj.get('icon')||'',
                                nickname:founderObj.get('nickname')||''
                            });
                            var userLevel = founderObj.get('level');
                            result[i].set('max_num', clanParam.getMaxClanUsers(userLevel));
                            outResult       = result[i];
                            userClan.push(outResult);
                        }
                        ret.selfClan = userClan;
                        getRecommendClan (clanids,review_clanids);
                    }
                });
            }else{
                ret.selfClan =[];
                getRecommendClan ();
            }

        },function(error) {
            ret.selfClan =[];
            getRecommendClan ();
        });
    }

    var getRecommendClan = function (clanids,review_clanids){
        var userGeoPoint = userInfo.get('actual_position');
        var query = new AV.Query(Clan);
        query.limit(2);
        var arr_clanids = [];
        if(clanids){
            arr_clanids = arr_clanids.concat(clanids);
        }
        if(review_clanids){
            arr_clanids =arr_clanids.concat(review_clanids);
        }
        if(arr_clanids){
            query.notContainedIn("objectId",arr_clanids);
        }

        if(tags[index]){
            query.equalTo("tags", tags[index]);
        }
        if (userGeoPoint)
            query.near("position", userGeoPoint);
        query.equalTo("is_full", false);
        query.find({
            success: function(result) {
                if(result.length==0){
                    var query = new AV.Query(Clan);
                    query.limit(2);
                    if (arr_clanids) {
                        query.notContainedIn('objectId', arr_clanids);
                    }
                    if (userGeoPoint) {
                        query.near("position", userGeoPoint);
                    }
                    query.include('founder_id');
                    query.equalTo("is_full", false);
                    query.find({
                        success : function(result){
                            formatResult(result);
                        }
                    });
                }else{
                    formatResult(result);
                }
            }
        });
        var formatResult =function (result){
            var recommendClan = [];
            for (var i = 0; i < result.length; i++) {
                var outResult = {};
                var arrayTagName = [];
                var arrayTag = result[i].get('tags');
                for (var k in arrayTag) {
                    var name = '';
                    if (HPGlobalParam.hpTags[arrayTag[k]]) {
                        name = HPGlobalParam.hpTags[arrayTag[k]].get('tag_name');
                    }
                    arrayTagName.push(name);
                }
                if (arrayTagName.length) {
                    result[i].set('tagsName', arrayTagName);
                }
                outResult       = result[i];
                var founderObj = result[i].get('founder_id');
                result[i].set('founder_id', _.pick(founderObj._toFullJSON(), pickUserKeys));
                result[i].set('founder_userinfo', {
                    icon:founderObj.get('icon')||'',
                    nickname:founderObj.get('nickname')||''
                });
                var userLevel = founderObj.get('level');
                result[i].set('max_num', clanParam.getMaxClanUsers(userLevel));
                recommendClan.push(outResult);
            }
            ret.recommendClan = recommendClan;
            res.success(ret);
        }
    }
    getSelfClan(userid);
});

function isClanFull(clan) {
    var level = clan.get("founder_id").get("level");
    var currClanNum = clan.get('current_num');
    var maxClanNum = clanParam.getMaxClanUsers(level);

    return currClanNum >= maxClanNum;
}


function NotInClan(userid, clanid,callback){
    var query = new AV.Query('ClanUser');
    query.equalTo("user_id", AV.Object.createWithoutData("_User", userid, false));
    query.equalTo("clan_id", AV.Object.createWithoutData("ClanUser", clanid, false));
    query.count({
        success: function(count){
            callback(count==0);
        },
        error: function(err){
            callback(false);

        }
    });
}


function addClanUser(userid, clanid, callback) {
    var ClanUser = AV.Object.extend("ClanUser");
    var clanUser = new ClanUser();
    clanUser.set("user_id", AV.Object.createWithoutData("_User", userid, false));
    clanUser.set("clan_id", AV.Object.createWithoutData("Clan", clanid, false));
    clanUser.set("user_level", 1);
    clanUser.save(null, {
        success: function (clanUser) {
            callback(true, clanUser);
        },
        error: function () {
            callback(false);
        }
    });
}

function addReviewClanUser(userid, clanid, callback) {
    var ClanReviewUser = AV.Object.extend("ClanReviewUser");
    var clanUser = new ClanReviewUser();
    clanUser.set("user_id", AV.Object.createWithoutData("_User", userid, false));
    clanUser.set("clan_id", AV.Object.createWithoutData("Clan", clanid, false));
    clanUser.save().then(function(success){
        var UserInfo = AV.Object.extend("_User");
        var query = new AV.Query(UserInfo);
        query.get(userid, {
            success: function(UserInfo) {
                UserInfo.addUnique("review_clanids",clanid);
                UserInfo.save().then(function(success){
                    callback(true);
                },function(error){
                    callback(false);
                });
            },
            error: function(object, error) {
                callback(false);
            }
        });
    }),function(error){
        callback(false);
    }
}

function removeReviewClanUser(userid, clanid, callback) {
    var query = new AV.Query('ClanReviewUser');
    query.equalTo("user_id", AV.Object.createWithoutData("_User", userid, false));
    query.equalTo("clan_id", AV.Object.createWithoutData("Clan", clanid, false));
    query.destroyAll().then(function(success) {
        var UserInfo = AV.Object.extend("_User");
        var query = new AV.Query(UserInfo);
        query.get(userid, {
            success: function(UserInfo) {
                UserInfo.remove("review_clanids",clanid);
                UserInfo.save().then(function(success){
                    callback(true);
                },function(error){
                    callback(false);
                });
            },
            error: function(object, error) {
                callback(false);
            }
        });
    }, function(error) {
        callback(false);
    });
}

/*
    加入部落
    函数名：
        joinClan
    参数：
        userid:objectId 用户ID
        clanid:objectId 部落ID
    返回：
        error:加入失败
        success:
            {
                code: Integer
                    0:加入成功
                    1:发送成功，酋长审核中
                    2:已经申请过，等待酋长审核
                describe:string 描述
            }
 */
AV.Cloud.define("joinClan", function (req, res) {
    if (!req.user || !req.user.id) {
        res.error('请登录账号!');
        return;
    }

    var userid = req.params.userid;
    var clanid = req.params.clanid;

    if (!userid || !clanid) {
        res.error("传入的参数有误");
        return;
    }

    //首先判断用户是否已经加入了部落
    var query = new AV.Query('ClanUser');
    query.equalTo('clan_id', AV.Object.createWithoutData('Clan', clanid));
    query.equalTo('user_id', AV.User.createWithoutData('_User', userid));
    query.first().then(function(clanUser){
        if (clanUser) {
            res.success({
                code:0,
                describe:'您已经加入部落！'
            });
            return;
        }

        var query = new AV.Query('Clan');
        query.include("founder_id.level");
        query.get(clanid).then(function (clan) {
            if (!clan) {
                console.info('部落不存在:%s', clan.id);
                res.error('部落不存在!');
                return;
            }

            if (isClanFull(clan)) {
                res.error('部落人员已满!');
                return;
            }

            var joinMode = clan.get('join_mode');
            switch (joinMode)
            {
                case 1:
                    addClanUser(userid, clanid, function(success) {
                        if (!success) {
                            res.error('加入部落失败');
                        }
                        else {
                            //向部落拥有者发送消息流，告知我已经加入该部落
                            var queryUser = new AV.Query('_User');
                            queryUser.equalTo('objectId', clan.get('founder_id').id);
                            common.sendStatus('addToClan', AV.User.createWithoutData('_User',userid), clan.get('founder_id'), queryUser,{clan:clan});
                            res.success({
                                code:0
                            });
                        }
                    });
                    break;
                case 2:
                    var query = new AV.Query('ClanReviewUser');
                    query.equalTo("user_id", AV.Object.createWithoutData("_User", userid, false));
                    query.equalTo("clan_id", AV.Object.createWithoutData("ClanUser", clanid, false));
                    query.count().then(function(count){
                        if(count>0){
                            res.success({
                                code:2,
                                describe:'已申请过加入部落'
                            });
                            return;
                        }else{
                            var query = new AV.Query('_User');
                            query.get(userid, {
                                success: function (fromUser) {
                                    addReviewClanUser(userid, clanid, function(success) {
                                        if (success) {
                                            common.postRCMessage(userid, clan.get("founder_id").id,
                                                "请求加入"+clan.get("title"),'requestJoinClan',clanid
                                            );
                                            res.success({
                                                code:1,
                                                describe: '已经发送申请'
                                            });
                                        }
                                        else {
                                            res.error('加入部落失败');
                                        }
                                    });
                                },
                                error: function (error) {
                                    res.error('用户不存在!');
                                }
                            })
                            return;
                        }
                    },function(error){
                        res.error('申请部落失败');
                    });
                    break;
            }
        });
    }, function(err){
        console.error('加入部落失败:', err);
        res.error('加入部落失败,错误码:'+err.code);
    });
});


AV.Cloud.define("reviewClan", function (req, res) {
    if (!req.user || !req.user.id) {
        res.error('请登录账号!');
        return;
    }

    var userid = req.params.userid;
    var clanid = req.params.clanid;
    var findFriendId = (req.user && req.user.id);
    // type 1允许 2拒绝
    var type = req.params.type;

    if (!userid || !clanid||!type) {
        res.error("传入的参数有误");
        return;
    }
    var query = new AV.Query('Clan');
    query.include("founder_id.level");
    query.get(clanid, {
        success: function (clan) {
            if (!clan) {
                console.info('部落不存在:%s', clan.id);
                res.error('部落不存在!');
                return;
            }
            if (isClanFull(clan)) {
                res.error('部落人员已满!');
                return;
            }
            NotInClan(userid, clanid, function(success) {
                if (!success) {
                    res.error('已加入过部落');
                    return
                }
            });
        },
        error: function (error) {
            console.error('beforeSave ClanUser query error:', error);
            res.error('部落不存在！');
        }
    }).then(function (clan) {
        if(type == 1){
            var query = new AV.Query('_User');
            query.get(userid, {
                success: function (JoinUser) {
                    addClanUser(userid, clanid, function(success, clanUser) {
                        if (success) {
                            removeReviewClanUser(userid,clanid,function(success){
                                var query = new AV.Query('_User');
                                query.equalTo('objectId', userid);
                                common.sendStatus('allowToJoinClan', clan.get('founder_id'), JoinUser, query, {clan:clan});

                                //获取user详细信息，查询和当前用户的好友关系，裁剪数据后再返回
                                var user = clanUser.get('user_id');
                                user.fetch().then(function(user){
                                    var refUsers = [user];
                                    common.findFriendShipForUsers(findFriendId, refUsers).then(function(friendObj){
                                        var currUser = refUsers[0];
                                        var tags = clanUser.get('tags');
                                        clanUser = clanUser._toFullJSON();
                                        //保留的user keys
                                        var pickUserKeys = ["objectId", "nickname", "className", "icon", "__type", 'sex', 'age', 'tags', 'friendCount',
                                            'actual_position', 'normal_area', 'clanCount', 'noRemoveFromFriend'];
                                        clanUser.user_id = _.pick(currUser._toFullJSON(), pickUserKeys);
                                        res.success({
                                            user:clanUser,
                                            extra:{
                                                userTagNames:common.tagNameFromId(tags),
                                                isFriend:friendObj[currUser.id]?true:false
                                            }
                                        });
                                    }, function(err){
                                        res.error('加入部落失败，错误码:'+err.code);
                                    });
                                });
                            });
                        }
                        else {
                            res.error('加入部落失败');
                        }
                    });
                },
                error: function (error) {
                    res.error('用户不存在!');
                }
            })
        }else {
            var query = new AV.Query('_User');
            query.get(userid, {
                success: function (JoinUser) {
                    removeReviewClanUser(userid,clanid,function(success){
                        var query = new AV.Query('_User');
                        query.equalTo('objectId', userid);
                        common.sendStatus('refuseToJoinClan', clan.get('founder_id'), JoinUser, query, {clan:clan});
                        res.success('拒绝申请加入部落');
                    });
                },
                error: function (error) {
                    res.error('用户不存在!');
                }
            })
        }
    });
});

