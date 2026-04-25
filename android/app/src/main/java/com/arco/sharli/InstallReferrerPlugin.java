package com.arco.sharli;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "InstallReferrer")
public class InstallReferrerPlugin extends Plugin {

    @PluginMethod
    public void getReferrer(PluginCall call) {
        InstallReferrerClient client = InstallReferrerClient.newBuilder(getContext()).build();
        client.startConnection(new InstallReferrerStateListener() {
            @Override
            public void onInstallReferrerSetupFinished(int responseCode) {
                try {
                    if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                        ReferrerDetails details = client.getInstallReferrer();
                        JSObject result = new JSObject();
                        result.put("referrer", details.getInstallReferrer());
                        call.resolve(result);
                    } else {
                        call.resolve(new JSObject());
                    }
                } catch (Exception e) {
                    call.resolve(new JSObject());
                } finally {
                    client.endConnection();
                }
            }

            @Override
            public void onInstallReferrerServiceDisconnected() {
                call.resolve(new JSObject());
            }
        });
    }
}
