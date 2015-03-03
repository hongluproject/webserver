/**
 * Created by fugang on 14/12/11.
 */

/**	资讯内容保存后，写入资讯URL，供APP展现
 *
 */
AV.Cloud.afterSave('News', function(request){
    var newsObj = request.object;
    var newsObjectId = newsObj.id;
    newsObj.set('contents_url', 'https://hoopeng.avosapps.com/news/' + newsObjectId);
    newsObj.save();
});
