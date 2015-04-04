var clanParam = require('cloud/common.js').clanParam;
var myutils = require('cloud/utils.js');
var common = require('cloud/common.js');

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
        success: function () {
            callback(true);
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




//
AV.Cloud.define("joinClan", function (req, res) {

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
            res.error('您已经加入部落！');
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
                            res.success();
                        }
                    });
                    break;
                case 2:
                    var query = new AV.Query('ClanReviewUser');
                    query.equalTo("user_id", AV.Object.createWithoutData("_User", userid, false));
                    query.equalTo("clan_id", AV.Object.createWithoutData("ClanUser", clanid, false));
                    query.count().then(function(count){
                        if(count>0){
                            res.success('已申请过部落');
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
                                            res.success('已经发送申请');
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
    var userid = req.params.userid;
    var clanid = req.params.clanid;
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
                    addClanUser(userid, clanid, function(success) {
                        if (success) {
                            removeReviewClanUser(userid,clanid,function(success){
                                var query = new AV.Query('_User');
                                query.equalTo('objectId', userid);
                                common.sendStatus('allowToJoinClan', clan.get('founder_id'), JoinUser, query, {clan:clan});
                                res.success('加入部落成功');
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

