var clanParam = require('cloud/common.js').clanParam;
var myutils = require('cloud/utils.js');

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
        query.select("nickname","tags","clanids","actual_position",'level');
        query.get(userid).then(function(result) {
            userInfo =  result;
            var  clanids = result.get("clanids");
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
                        getRecommendClan (clanids);
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

    var getRecommendClan = function (clanids){
        var userGeoPoint = userInfo.get('actual_position');
        var query = new AV.Query(Clan);
        query.limit(2);
        if(clanids)
        query.notContainedIn("objectId",clanids);
        if(tags[index])
        query.equalTo("tags", tags[index]);
        if (userGeoPoint)
        query.near("position", userGeoPoint);
        query.equalTo("is_full", false);
        query.find({
            success: function(result) {
                if(result.length==0){
                    var query = new AV.Query(Clan);
                    query.limit(2);
                    if(clanids) {
                        query.notContainedIn("objectId",clanids);
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

    return currClanNum == maxClanNum;
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

    clanUser.save(null, {
        success: function () {
            callback(true);
        },
        error: function () {
            callback(false);
        }
    });
}

function removeReviewClanUser(userid, clanid, callback) {
    var query = new AV.Query('ClanReviewUser');

    query.equalTo("user_id", AV.Object.createWithoutData("_User", userid, false));
    query.equalTo("clan_id", AV.Object.createWithoutData("_User", userid, false));

    query.destroyAll({
        success: function(){
            callback(true);
        },
        error: function(err){
            callback(false);
        }
    });
}

function postRCMessage(fromUserId, toUserId, content, pushcontent, type) {
    console.log("fromUser:" + fromUserId, " toUserId:" + toUserId, " content:" + content, " type:" + type);

    var rcParam = myutils.getRongCloudParam();

    //通过avcloud发送HTTP的post请求
    AV.Cloud.httpRequest({
        method: 'POST',
        url: 'https://api.cn.rong.io/message/system/publish.json',
        headers: {
            'App-Key': rcParam.appKey,
            'Nonce': rcParam.nonce,
            'Timestamp': rcParam.timestamp,
            'Signature': rcParam.signature
        },
        body: {
            fromUserId:fromUserId,
            toUserId:toUserId,
            objectName:type,
            content:content,
            pushContent:pushcontent
        },
        success: function(httpResponse) {
            console.info('postRCMessage:rongcloud response is '+httpResponse.text);
            delete httpResponse.data.code;
        },
        error: function(httpResponse) {
            var errmsg = 'Request failed with response code ' + httpResponse.status;
            console.error('postRCMessage:'+errmsg);
        }
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
        },

        error: function (error) {
            console.error('beforeSave ClanUser query error:', error);
            res.error('部落不存在！');
        }

    }).then(function (clan) {
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
                var query = new AV.Query('_User');
                query.get(userid, {
                    success: function (fromUser) {
                        addReviewClanUser(userid, clanid, function(success) {
                            if (success) {
                                postRCMessage(userid, clan.get("founder_id").id, {"clanid":clanid},
                                    fromUser.get("nickname")+"请求加入部落"+clan.get("title"), "requestJoinClan");
                                res.success();
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
                break;
        }
    });
});

