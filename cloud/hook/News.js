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

    //对应分类的文章数量加1
    var clanCate = request.object.get('clanCateId');
    var clan = request.object.get('clanId');
    if (!_.isEmpty(clanCate) && !_.isEmpty(clan)) {
        var query = new AV.Query('ClanCategoryCount');
        query.equalTo('clanId', clan.id);
        query.equalTo('clanCateId', clanCate.id);
        query.first().then(function(clanCategoryCountItem){
           if (clanCategoryCountItem) {
               clanCategoryCountItem.increment('cateCount');
               clanCategoryCountItem.fetchWhenSave(true);
               clanCategoryCountItem.save();
           } else {
               var ClanCategoryCountItem = AV.Object.extend('ClanCategoryCount');
               clanCategoryCountItem = new ClanCategoryCountItem();
               clanCategoryCountItem.set('clanCateId', clanCate.id);
               clanCategoryCountItem.set('clanId', clan.id);
               clanCategoryCountItem.set('cateCount', 1);
               clanCategoryCountItem.save();
           }
        });
    }
});
