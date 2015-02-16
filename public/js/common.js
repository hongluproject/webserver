/**
 * Created by fugang on 15/2/15.
 */
function isInHoopeng() {
    try {
        if (external.appName() == "hoopeng") {
            return true;
        }
    } catch (e) {
        return false;
    }

    return false;
}

function doFilter(methodName,type, objectId, objectName) {
    if (isInHoopeng()) {
        external.callMethod(methodName,JSON.stringify({"type":type,"objectId":objectId,"objectName":objectName}));
    }
}

function imageClick(imgSrc,idx){
    if (isInHoopeng()) {
        external.callMethod("imgSlide", JSON.stringify({"imgs": imgSrc, "idx": idx}));
    }
}

function doClient() {
    if (navigator.userAgent.match(/(iPhone|iPod|iPad);?/i)) {
        var loadDateTime = new Date();
        window.setTimeout(function() {
            var timeOutDateTime = new Date();
            if (timeOutDateTime - loadDateTime < 2000) {
                window.location = "https://itunes.apple.com/cn/app/id952260502?mt=8";
            } else {
                window.close();
            }
        }, 25);
    } else if (navigator.userAgent.match(/android/i)) {
        var state = null;
        try {
            window.location = "http://www.imsahala.com/sahala.apk";
        } catch (e) {}
        if (state) {
            window.close();
        } else {
            window.location = "http://www.imsahala.com/sahala.apk";
        }
    }
}