/**
 * Created by fugang on 14/12/11.
 */


/** 如果有新增的资讯评论，资讯表里面的评论数加1
 *
 */
AV.Cloud.afterSave('NewsComment', function(request){
    var newsObj = request.object.get('newsid');
    newsObj.increment('comment_count');
    newsObj.save();
});

/** 有评论被删除时，对应资讯的评论数也相应减少
 *
 */
AV.Cloud.afterDelete('NewsComment', function(request){
    var newsObj = request.object.get('newsid');
    if (newsObj.get('comment_count') > 0) {
        newsObj.increment('comment_count', -1);
        newsObj.save();
    } else {
        console.warn('afterDelete for NewsComment:comment count is less than zero');
    }
});
