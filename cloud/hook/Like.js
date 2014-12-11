/**
 * Created by fugang on 14/12/11.
 */


/** 添加点赞时，对应的文章源点赞数动态调整
 *
 */
AV.Cloud.afterSave('Like', function(request){
    var likeType = request.object.get('like_type');
    if (likeType == 1) {	//资讯点赞
        var newsObj = request.object.get('newsid');
        newsObj.increment('up_count');
        newsObj.save();

    } else if (likeType == 2) {	//动态点赞
        var dynamicObj = request.object.get('dynamic_id');
        dynamicObj.increment('up_count');
        dynamicObj.save();
    }
});

/** 取消点赞时，对应的文章源点赞数相应减少
 *
 */
AV.Cloud.afterDelete('Like', function(request) {
    var likeType = request.object.get('like_type');
    if (likeType == 1) {	//资讯点赞
        var newsObj = request.object.get('newsid');
        if (newsObj.get('up_count') > 0) {
            newsObj.increment('up_count', -1);
            newsObj.save();
        } else {
            console.warn('afterDelete Like for news:up_count is less than zero');
        }

    } else if (likeType == 2) {	//动态点赞
        var dynamicObj = request.object.get('dynamic_id')
        if (dynamicObj.get('up_count') > 0) {
            dynamicObj.increment('up_count', -1);
            dynamicObj.save();
        } else {
            console.warn('afterDelete Like for dynamic:up_count is less than zero');
        }
    }
});
