/**
 * Created by fugang on 15/2/15.
 */
function isInHoopeng() {
    try {
        if (external.appName() == "hoopeng") {
            return true;
        }
        var user = external.currentUser();
     //   window.alert(user.username);
        console.info("xxxxxxxxxxxxxxxxxxxxxx"+user);
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
                window.location = "http://a.app.qq.com/o/simple.jsp?pkgname=com.honglu.sahala";
            } else {
                window.close();
            }
        }, 25);
    } else if (navigator.userAgent.match(/android/i)) {
        var state = null;
        try {
            window.location = "http://a.app.qq.com/o/simple.jsp?pkgname=com.honglu.sahala";
        } catch (e) {}
        if (state) {
            window.close();
        } else {
            window.location = "http://a.app.qq.com/o/simple.jsp?pkgname=com.honglu.sahala";
        }
    }
}