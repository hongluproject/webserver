/**
 * Created by fugang on 14/12/11.
 */
var utils = require('cloud/utils.js');
var common = require('cloud/common.js');


/** 添加点赞时，对应的文章源点赞数动态调整
 *
 */
AV.Cloud.afterSave('Like', function(request){
    var likeType = request.object.get('like_type');
    var targetId = request.object.get('external_id');
    var likeUser = request.object.get('user_id');
    if (likeType == 1) {	//资讯点赞
        var query = new AV.Query('News');
        query.get(targetId, {
            success: function(result) {
                console.info("Like afterSave up_count increment for News,current up_count is %d", result.get('up_count'));
                result.fetchWhenSave(true);
                result.increment("up_count");
                result.save();
            },
            error: function(error) {
                console.error( "Like afterSave:Got an error " + error.code + " : " + error.message);
            }
        });
    } else if (likeType == 2) {	//动态点赞
        var query = new AV.Query('DynamicNews');
        query.get(targetId, {
            success: function(dynamic) {
                console.info("Like afterSave up_count increment for DynamicNews,current up_count is %d", dynamic.get('up_count'));
                dynamic.fetchWhenSave(true);
                dynamic.increment('up_count');
                dynamic.save();

                var postUser = dynamic.get('user_id');
                if (!postUser) {
                    return;
                }
                if (postUser.id == likeUser.id) {
                    console.info('点赞用户和发布者是同一人，不用发事件流:%s', postUser.id);
                    return;
                }

                //向动态发布者发送事件流，告知他的动态被 likeUser 评论了
                var query = new AV.Query('_User');
                query.equalTo('objectId', postUser.id);
                common.sendStatus('newLike', likeUser, postUser, query, {dynamicNews:dynamic});
            },
            error: function(error) {
                console.error( "Like afterSave:Got an error " + error.code + " : " + error.message);
            }
        });
    }
});

/** 取消点赞时，对应的文章源点赞数相应减少
 *
 */
AV.Cloud.afterDelete('Like', function(request) {
    var likeType = request.object.get('like_type');
    var targetId = request.object.get('external_id');
    if (likeType == 1) {	//资讯点赞
        var query = new AV.Query('News');
        query.get(targetId, {
            success: function(result) {
                console.info("Like afterDelete up_count increment for news,current up_count is %d", result.get('up_count'));
                if (result.get('up_count') > 0) {
                    result.fetchWhenSave(true);
                    result.increment("up_count", -1);
                    result.save();
                } else {
                    console.info('up_count is less than zero');
                }
            },
            error: function(error) {
                console.error( "Like afterSave:Got an error " + error.code + " : " + error.message);
            }
        });
    } else if (likeType == 2) {	//动态点赞
        var query = new AV.Query('DynamicNews');
        query.get(targetId, {
            success: function(result) {
                console.info("Like afterDelete up_count increment for DynamicNews,current up_count is %d", result.get('up_count'));
                //点赞次数累加
                if (result.get('up_count') > 0) {
                    result.fetchWhenSave(true);
                    result.increment('up_count', -1);
                    result.save();
                } else {
                    console.info('up_count is less than zero');
                }

                //发送消息流给动态发布者
            },
            error: function(error) {
                console.error( "Like afterSave:Got an error " + error.code + " : " + error.message);
            }
        });
    }
});
