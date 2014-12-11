/**
 * Created by fugang on 14/12/11.
 */


/** 添加点赞时，对应的文章源点赞数动态调整
 *
 */
AV.Cloud.afterSave('Like', function(request){
    var likeType = request.object.get('like_type');
    var targetId = request.object.get('external_id');
    if (likeType == 1) {	//资讯点赞
        var query = new AV.Query('News');
        query.get(targetId, {
            success: function(result) {
                console.info("Like afterSave up_count increment for News,current up_count is %d", result.get('up_count'));
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
            success: function(result) {
                console.info("Like afterSave up_count increment for DynamicNews,current up_count is %d", result.get('up_count'));
                result.increment('up_count');
                result.save();
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
