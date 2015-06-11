/**
 * Created by fugang on 14/12/11.
 */

var myutils = require('cloud/utils.js');
var querystring = require('querystring');
var common = require('cloud/common');
var _ = AV._;
var Promise = AV.Promise;
var utils = require('cloud/utils');

/*
    消息转发：
    函数名：transmitMessage
    参数：
        toUser: [   转发目标用户
                {
                    targetType:string
                         'clan'      部落
                         'activity'  活动
                         'user'      个人
                    userIds:array
                },
                ...
        ]
        messageContent:string 消息体，为字符串，server端只负责转发此消息
    返回：
        success or error
 */
AV.Cloud.define('transmitMessage', function(req, res){
    var userId = req.user && req.user.id;
    var toUser = req.params.toUser;
    var messageContent = req.params.messageContent;

    var promise = Promise.as();
    var promise2 = Promise.as();
    var rcParam = utils.getRongCloudParam();
    promise2.then(function(){
        _.each(toUser, function(user){
            var postUrl;
            promise = promise.then(function(){
                if (user.targetType == 'user'){
                    postUrl = 'https://api.cn.rong.io/message/private/publish.json';
                    var body = {
                        fromUserId: userId,
                        toUserId: user.userIds&&user.userIds.concat(userId),
                        objectName: "RC:ImgTextMsg",
                        content:messageContent
                    }
                } else if (user.targetType == 'clan') {
                    postUrl = 'https://api.cn.rong.io/message/group/publish.json';
                    var body = {
                        fromUserId: userId,
                        toGroupId: user.userIds,
                        objectName: "RC:ImgTextMsg",
                        content:messageContent
                    }
                } else if (user.targetType == 'activity') {
                    postUrl = 'https://api.cn.rong.io/message/group/publish.json';
                    var body = {
                        fromUserId: userId,
                        toGroupId: _.map(user.userIds,function(userId){
                            return 'activity-'.concat(userId);
                        }),
                        objectName: "RC:ImgTextMsg",
                        content:messageContent
                    }
                }

                return AV.Cloud.httpRequest({
                    method: 'POST',
                    url: postUrl,
                    headers: {
                        'App-Key': rcParam.appKey,
                        'Nonce': rcParam.nonce,
                        'Timestamp': rcParam.timestamp,
                        'Signature': rcParam.signature
                    },
                    body:querystring.stringify(body)}).then(function(res){
                    return Promise.as();
                }).catch(function(err){
                    console.error('transmit message error:', err);
                    return Promise.as();
                });
            });
        });
        return promise;
    }).then(function(){
        res.success();
    });
});

/** 通过群组ID获取群组名称
 *  函数名：imGetGroupnameFromId
 *  参数：
 *      groupId:objectId 群组ID
 *  返回：
 *      {
 *          groupType:string 'clan':部落 'activity':活动
 *          id:objectId 部落 or 活动ID
 *          name:string 名称
 *          icon:string 头像
 *      }
 *  处理流程：
 *      1、先查询Clan表，看对应ID的object是否存在。
 *      2、若1失败，再查询Activity表。
 */
AV.Cloud.define('imGetGroupnameFromId', function(req, res){
   var groupId = req.params.groupId;
    if (!groupId) {
        res.error('请传入ID！');
        return;
    }

    var query = new AV.Query('Clan');
    query.select('title', 'icon');
    query.equalTo('objectId', groupId);
    query.first().then(function(clan){
        if (clan) {
            return AV.Promise.as(clan);
        } else {
            query = new AV.Query('Activity');
            query.select('title', 'index_thumb_image');
            query.equalTo('objectId', groupId);
            return query.first();
        }
    }).then(function(result){
        if (result) {
            if (result.className == 'Clan') {

                res.success({
                    type:'clan',
                    id:groupId,
                    name:result.get('title')||'',
                    icon:result.get('icon')||''
                })
            } else if (result.className == 'Activity') {
                res.success({
                    type:'activity',
                    id:groupId,
                    name:result.get('title')||'',
                    icon:result.get('index_thumb_image')||''
                });
            }
        }

    }, function(err){
       console.error('getGroupnameFromId error:', err);
        res.error('获取群组名称失败,错误码:'+err.code);
    });
});

/**
 * 获取融云token接口
 * @userobjid   用户objectid，通过该ID获取到用户信息，再向融云发起获取token请求
 */
AV.Cloud.define('imGetToken', function(req, res){
    //请求参数检查
    var userobjid = req.params.userid;
    if (userobjid ==  undefined) {
        console.error('getimtoken:userid is undefined');
        res.error('userid is expected!');
        return;
    }
    console.info("getimtoken:userid:%s", userobjid);

    //根据id查询用户表
    var hpUser = common.extendClass("_User");
    var query = new AV.Query(hpUser);
    query.get(userobjid, {
        success:function(userObj) {
            var username = userObj.get('nickname');
            var icon = userObj.get('icon');

            var rcParam = myutils.getRongCloudParam();
            console.info("getimtoken:", rcParam);

            //通过avcloud发送HTTP的post请求
            AV.Cloud.httpRequest({
                method: 'POST',
                url: 'https://api.cn.rong.io/user/getToken.json',
                headers: {
                    'App-Key': rcParam.appKey,
                    'Nonce': rcParam.nonce,
                    'Timestamp': rcParam.timestamp,
                    'Signature': rcParam.signature
                },
                body: querystring.stringify({
                            userId:userobjid,
                            name:username,
                            portraitUri:icon
                        }),
                success: function(httpResponse) {
                    console.info('getimtoken:rongcloud response is '+httpResponse.text);

                    delete httpResponse.data.code;
                    res.success(httpResponse.data);
                },
                error: function(httpResponse) {
                    var errmsg = 'Request failed with response code ' + httpResponse.status;
                    console.error('getimtoken:'+errmsg);
                    res.error(errmsg);
                }
            });
        },
        error:function(object,error) {
            // The object was not retrieved successfully.
            // error is a AV.Error with an error code and description.
            console.log(error);

            var errmsg = 'query object fail:' + error.code;

            res.error(errmsg);
        }
    });

    //账号登陆时，关注撒哈拉官方小助手
    common.followSahalaAssistants(req.user.id);
});


AV.Cloud.define("imGetClanUser",function(req, res){
    var clan_id = req.params.clan_id;
    var type = req.params.type;
    if (!clan_id) {
        res.error('请输入部落信息');
        return;
    }
    //根据部落ID查询ClanUser表
    if(type == 2){
        var query = new AV.Query('ClanReviewUser');
    }else{
        var query = new AV.Query('ClanUser');
    }

    query.equalTo("clan_id", AV.Object.createWithoutData('Clan', clan_id));
    query.include("user_id");
    query.include("clan_id");
    query.find({
        success: function(results) {
            var finalResult = [];
            for (var i in results) {
                var outChannel = {};
                var user =  results[i].get("user_id");
                var clan =  results[i].get("clan_id");
                //this level belong to table ClanUser
                if (user && clan) {
                    outChannel.userIcon     =  user.get("icon");
                    outChannel.userNickName =  user.get("nickname");
                    outChannel.userObjectId =  user.id;
                    outChannel.clanName =  clan.get("title");
                    outChannel.clanIcon =  clan.get("icon");
                    outChannel.objectId = outChannel.clanUserObjectId = results[i].id;
                    outChannel.userLevel = results[i].get('user_level');
                    finalResult.push(outChannel);
                }
            }
            res.success(finalResult);
        },
        error: function(error) {
            console.error("Error: " + error.code + " " + error.message);
        }

    });

});

/**  加入聊天群组，具体使用场景：
 * 		用户申请加入部落，长老批准通过后，即可调用此接口，将该用户加入聊天群组
 *	@param {
 *		"userid":用户objectId
 	*	"groupid":群组id
    *	"groupname":群组名称
 *  }
 */
AV.Cloud.define('imAddToGroup', function(request, response){
    //read request body first
    var userid = request.params.userid;
    var groupid = request.params.groupid;
    var groupname = request.params.groupname;

    //请求参数检查
    //userid or groupid cann't be empty
    if (userid==undefined || groupid==undefined) {
        console.error("imAddToGroup:userid:%s groupid:%s", userid,groupid);
        response.error('请求参数异常！');
        return;
    }
    console.info('imAddToGroup:userid:%s groupid:%s groupname:%s', userid, groupid, groupname);
    var rcParam = myutils.getRongCloudParam();

    console.info('imAddToGroup:rong cloud param:%s', JSON.stringify(rcParam));

    //通过avcloud发送HTTP的post请求
    AV.Cloud.httpRequest({
        method: 'POST',
        url: 'https://api.cn.rong.io/group/join.json',
        headers: {
            'App-Key': rcParam.appKey,
            'Nonce': rcParam.nonce,
            'Timestamp': rcParam.timestamp,
            'Signature': rcParam.signature
        },
        body: querystring.stringify({
                    userId:userid,
                    groupId:groupid,
                    groupName:groupname
                }),
        success: function(httpResponse) {
            console.info('imAddToGroup:rong cloud response is '+httpResponse.text);
            if (httpResponse.data.code == 200)
                response.success('加入聊天群组成功');
            else
                response.error('加入聊天群组失败,code='+httpResponse.data.code);
        },
        error: function(httpResponse) {
            var errmsg = 'Request failed with response code ' + httpResponse.status;
            console.error('imAddToGroup:'+errmsg);
            response.error(errmsg);
        }
    });

    //check weather group  has  exist
});

/** 将某用户id从某组群id中去除
 * 	使用场景：部落长老，将某用户从部落中剔除，该用户也同时从部落中删除
 *	@param {
 *	"userid":用户id
 *	"groupid":群组id
 *}
 *
 */
AV.Cloud.define('imQuitGroup', function(request, response){
    //read request body first
    var userid = request.params.userid;
    var groupid = request.params.groupid;

    //请求参数检查
    if (userid==undefined || groupid==undefined) {
        console.error('imQuitGroup:userid:%s groupid:%s', userid, groupid);
        response.error('请求参数异常！');
        return;
    }
    console.info("imQuitGroup:userid:%s groupid:%s", userid, groupid);

    var rcParam = myutils.getRongCloudParam();

    console.info('imQuitGroup:rong cloud param:%s', JSON.stringify(rcParam));

    //通过avcloud发送HTTP的post请求
    AV.Cloud.httpRequest({
        method: 'POST',
        url: 'https://api.cn.rong.io/group/quit.json',
        headers: {
            'App-Key': rcParam.appKey,
            'Nonce': rcParam.nonce,
            'Timestamp': rcParam.timestamp,
            'Signature': rcParam.signature
        },
        body: querystring.stringify({
                    userId:userid,
                    groupId:groupid
                }),
        success: function(httpResponse) {
            console.info('imQuitGroup:rong cloud response is '+httpResponse.text);
            if (httpResponse.data.code == 200)
                response.success('退出聊天群组成功');
            else
                response.success('退出聊天群组失败,code='+httpResponse.data.code);
        },
        error: function(httpResponse) {
            var errmsg = 'Request failed with response code ' + httpResponse.status;
            console.error('imQuitGroup:'+errmsg);
            response.error(errmsg);
        }
    });
});

/** 将某组群id解散
 * 	使用场景：某部落不再使用，在删除该部落的同时，删除其对应的聊天组群
 *	@param {
 *  "userid":操作解散用户id
 *	"groupid":群组id
 *}
 *
 */
AV.Cloud.define('imDismissGroup', function(request, response){
    //read request body first
    var userid = request.params.userid;
    var groupid = request.params.groupid;

    //请求参数检查
    if (userid==undefined || groupid==undefined) {
        console.error('imDismissGroup:userid:%s groupid:%s', userid, groupid);
        response.error('请求参数异常！');
        return;
    }
    console.info("imDismissGroup:userid:%s groupid:%s", userid, groupid);

    var rcParam = myutils.getRongCloudParam();
    console.info('imDismissGroup:rong cloud param:%s', JSON.stringify(rcParam));

    //通过avcloud发送HTTP的post请求
    AV.Cloud.httpRequest({
        method: 'POST',
        url: 'https://api.cn.rong.io/group/dismiss.json',
        headers: {
            'App-Key': rcParam.appKey,
            'Nonce': rcParam.nonce,
            'Timestamp': rcParam.timestamp,
            'Signature': rcParam.signature
        },
        body: querystring.stringify({
                    userId:userid,
                    groupId:groupid
                }),
        success: function(httpResponse) {
            console.info('imDismissGroup:rong cloud response is '+httpResponse.text);
            if (httpResponse.data.code == 200)
                response.success('解散聊天群组成功');
            else
                response.success('解散聊天群组失败,code='+httpResponse.data.code);
        },
        error: function(httpResponse) {
            var errmsg = 'Request failed with response code ' + httpResponse.status;
            console.error('imDismissGroup:'+errmsg);
            response.error(errmsg);
        }
    });

});

AV.Cloud.define('imUpdateGroupInfo', function(req, res){
    var groupId = req.params.groupId;
    var groupName = req.params.groupName;
    if (!groupId || !groupName) {
        res.error('缺少必要参数！');
        return;
    }

    var rcParam = myutils.getRongCloudParam();
    console.info("refreshClan:nonce:%d timestamp:%d singature:%s",
        rcParam.nonce, rcParam.timestamp, rcParam.signature);
    var reqBody = {
        groupId:groupId,
        groupName:groupName
    };
    console.info('Clan afterUpdate request body:', reqBody);
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
            console.info('refreshRCGroup:rongcloud response is '+httpResponse.text);
            res.success();
        },
        error: function(httpResponse) {
            var errmsg = 'Request failed with response code ' + httpResponse.status;
            console.error('refreshRCGroup:'+errmsg);
            res.error(errmsg);
        }
    });
});