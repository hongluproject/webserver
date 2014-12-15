/**
 * Created by fugang on 14/12/13.
 */

exports.initializeAvosData = function() {
        AV.HPGlobalParam = {};
        var globalObj = AV.HPGlobalParam;
        globalObj.hpTags = {};
        globalObj.hpAreas = {};
        globalObj.hpCates = {};

        //拉取所有的标签列表
        var queryTags = new AV.Query('Tag');
        queryTags.limit = 1000;
        queryTags.find(function(tagResults) {
            for (var i in tagResults) {
                var tagItem = tagResults[i];
                globalObj.hpTags[tagItem.id] = tagItem;
            }

            //拉取所有区域
            var queryAreas = new AV.Query('Area');
            queryAreas.limit = 1000;
            return queryAreas.find();
        }).then(function(areaResults) {
            for (var i in areaResults) {
                var areaItem = areaResults[i];
                globalObj.hpAreas[areaItem.id] = areaItem;
            }

            //拉取所有Cate
            var queryCate = new AV.Query('Cate');
            queryCate.limit = 1000;
            return queryCate.find();
        }).then(function(cateResults) {
            for (var i in cateResults) {
                var cateItem = cateResults[i];
                globalObj.hpCates[cateItem.id] = cateItem;
            }
        });

}
