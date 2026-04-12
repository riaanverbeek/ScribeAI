package com.fant.app;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

@CapacitorPlugin(name = "MediaStoreDownload")
public class MediaStoreDownloadPlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String base64Data = call.getString("data");
        String filename = call.getString("filename");
        String mimeType = call.getString("mimeType", "audio/webm");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("Missing required parameter: data");
            return;
        }
        if (filename == null || filename.isEmpty()) {
            call.reject("Missing required parameter: filename");
            return;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("MediaStore.Downloads requires Android 10 (API 29) or higher");
            return;
        }

        try {
            byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            Uri itemUri = getContext().getContentResolver().insert(collection, values);

            if (itemUri == null) {
                call.reject("Failed to create MediaStore entry");
                return;
            }

            try (OutputStream os = getContext().getContentResolver().openOutputStream(itemUri)) {
                if (os == null) {
                    call.reject("Failed to open output stream for MediaStore entry");
                    return;
                }
                os.write(fileBytes);
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            getContext().getContentResolver().update(itemUri, values, null, null);

            JSObject result = new JSObject();
            result.put("uri", itemUri.toString());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to save file to Downloads: " + e.getMessage(), e);
        }
    }
}
