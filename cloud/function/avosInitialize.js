/**
 * Created by fugang on 14/12/13.
 */

exports.initializeAvosData = function() {
        AV.HPGlobalParam = AV.HPGlobalParam || {};
        var globalObj = AV.HPGlobalParam;
        globalObj.hpTags = globalObj.hpTags || {};
        globalObj.hpAreas = globalObj.hpAreas || {};
        globalObj.hpCates = globalObj.hpCates || {};

        //拉取所有的标签列表
        var queryTags = new AV.Query('Tag');
        queryTags.limit = 1000;
        queryTags.find(function(tagResults) {
            globalObj.hpTags = {};
            for (var i in tagResults) {
                var tagItem = tagResults[i];
                globalObj.hpTags[tagItem.id] = tagItem;
            }

            console.info('get tags ok,tags count:%d', tagResults?tagResults.length:0);

            //拉取所有区域
            var queryAreas = new AV.Query('Area');
            queryAreas.limit = 1000;
            return queryAreas.find();
        }).then(function(areaResults) {
            globalObj.hpAreas = {};
            for (var i in areaResults) {
                var areaItem = areaResults[i];
                globalObj.hpAreas[areaItem.id] = areaItem;
            }

            console.info('get area ok,area count:%d', areaResults?areaResults.length:0);

            //拉取所有Cate
            var queryCate = new AV.Query('Cate');
            queryCate.limit = 1000;
            return queryCate.find();
        }).then(function(cateResults) {
            globalObj.hpCates = {};
            for (var i in cateResults) {
                var cateItem = cateResults[i];
                globalObj.hpCates[cateItem.id] = cateItem;
            }
            console.info('get cate ok,cate count:%d', cateResults?cateResults.length:0);
        });

}

/** 定时更新呼朋数据，在avos平台设置调用，每隔1小时更新一次
 *
 */
AV.Cloud.define('updateHPParamTimer', function(req, res) {
    exports.initializeAvosData();
});

/*  查询升级信息，APP每次启动的时候调用。
    @params:
        clientVersion:client Version
        deviceType: ios or android
        deviceVersion: 8.1.2
    @return:
    {
        needUpdate:true or false,
        updateType: 0 提示升级
                    1 强制升级
        message:升级提示
        clickURL:点击链接
    }
 */
AV.Cloud.define('checkUpdate', function(req, res) {
    var clientVersion = req.params.clientVersion;
    var deviceType = req.params.deviceType;
    var deviceVersion = req.params.deviceVersion;

    console.info('checkUpdate params, clientVersion:%s deviceType:%s deviceVersion:%s',
        clientVersion, deviceType, deviceVersion);

    res.success({
        needUpdate:false,
        updateType:0,
        message:'',
        clickURL:''
    });
})