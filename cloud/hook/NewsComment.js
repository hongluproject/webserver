/**
 * Created by fugang on 14/12/11.
 */


/** 如果有新增的资讯评论，资讯表里面的评论数加1
 *
 */
AV.Cloud.afterSave('NewsComment', function(request){
    var newsObj = request.object.get('newsid');
    newsObj.fetchWhenSave(true);
    newsObj.increment('comment_count');
    newsObj.save();
});

/** 有评论被删除时，对应资讯的评论数也相应减少
 *
 */
AV.Cloud.afterDelete('NewsComment', function(request){
    var newsObj = request.object.get('newsid');
    if (!newsObj)
        return;

    var queryNews = new AV.Query('News');
    queryNews.get(newsObj, {
        success:function(newResult) {
            //只有当其评论次数大于0，才允许减1
            if (newResult && newResult.get('comment_count')>0) {
                newsObj.fetchWhenSave(true);
                newsObj.increment('comment_count', -1);
                newsObj.save();
            }
        }
    });
});
