/**
 * Created by fugang on 14/12/11.
 */
var common = require('cloud/common.js');
var _ = AV._;

/**	资讯内容保存后，写入资讯URL，供APP展现
 *
 */
AV.Cloud.afterSave('News', function(request){
    var newsObj = request.object;
    if (_.isEmpty(newsObj.get('contents_url'))) {
        var newsObjectId = newsObj.id;
        var urlPath = common.isSahalaDevEnv()?'http://apidev.imsahala.com/news/':'http://api.imsahala.com/news/';
        newsObj.set('contents_url', urlPath.concat(newsObjectId));
        newsObj.save();
    }
});
