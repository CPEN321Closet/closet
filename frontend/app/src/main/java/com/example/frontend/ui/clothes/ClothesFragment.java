package com.example.frontend.ui.clothes;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.GridLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.Spinner;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.constraintlayout.widget.ConstraintSet;
import androidx.fragment.app.Fragment;
import androidx.test.espresso.idling.CountingIdlingResource;

import com.example.frontend.AddClothesActivity;
import com.example.frontend.MainActivity;
import com.example.frontend.R;
import com.example.frontend.EditClothesActivity;
import com.example.frontend.User;

import org.jetbrains.annotations.NotNull;

import java.io.IOException;
import java.util.Objects;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class ClothesFragment extends Fragment implements View.OnClickListener, AdapterView.OnItemSelectedListener {
    private static final String TAG ="ClothesFragment" ;
    private static final String EMPTY_STRING = "";

    private User user;
    private String path;
    private Bitmap bitmap;
    private String clothesId = EMPTY_STRING;

    private ImageButton buttonAdd;
    private GridLayout clothesLayout;
    private ImageView image;
    private Spinner spinner;
    private ConstraintLayout clothes;
    private int selectedId;

    private final int ADD = 1;
    private final int EDIT = 2;

    static View root;
    static CountingIdlingResource idlingResource = new CountingIdlingResource("send_add_clothes_request");

    public View onCreateView(@NonNull LayoutInflater inflater,
                             ViewGroup container, Bundle savedInstanceState) {
        root = inflater.inflate(R.layout.fragment_clothes, container, false);

        buttonAdd = root.findViewById(R.id.btn_clothes_add);
        buttonAdd.setOnClickListener(this);
        clothesLayout = root.findViewById(R.id.gl_clothes);

        return root;
    }

    public void setAdapter(int textArrayResId, @NotNull Spinner spinner) {
        // Create an ArrayAdapter using the string array and a default spinner layout
        ArrayAdapter<CharSequence> adapter = ArrayAdapter.createFromResource(ClothesFragment.this.getContext(),
                textArrayResId, android.R.layout.simple_spinner_item);

        // Specify the layout to use when the list of choices appears
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        // Apply the adapter to the spinner
        spinner.setAdapter(adapter);
    }

    @Override
    public void onClick(View view) {
        switch (view.getId()){
            case R.id.btn_clothes_add:
                idlingResource.increment();
                user = MainActivity.getUser();
                Intent addClothesIntent = new Intent(ClothesFragment.this.getContext(), AddClothesActivity.class);
                startActivityForResult(addClothesIntent, ADD);
                idlingResource.decrement();
                break;

            default:
        }
    }

    @Override
    public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
        selectedId = parent.getId();

        if (parent.getSelectedItem().toString().equals("Edit")) {

            while (clothesId.equals(EMPTY_STRING)) {
                Log.d(TAG, "waiting for clothes id");
            }

            Intent editClothesIntent = new Intent(ClothesFragment.this.getContext(), EditClothesActivity.class);
            editClothesIntent.putExtra("user", user);
            editClothesIntent.putExtra("path", path);
            editClothesIntent.putExtra("clothesId", clothesId);
            startActivityForResult(editClothesIntent, EDIT);
        }

        else if (parent.getSelectedItem().toString().equals("Delete")) {

            while (clothesId.equals(EMPTY_STRING)) {
                Log.d(TAG, "waiting for clothes id");
            }

            deleteClothesFromCloset(selectedId);
            deleteImageFromServer();
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (resultCode == Activity.RESULT_OK && requestCode == ADD) {
            // here you can retrieve your bundle data.
            path = data.getStringExtra("path");
            clothesId = data.getStringExtra("clothesId");
            bitmap = BitmapFactory.decodeFile(path);

            addClothesToCloset();
        }

        else if (resultCode == Activity.RESULT_OK && requestCode == EDIT) {
            path = data.getStringExtra("path");
            bitmap = BitmapFactory.decodeFile(path);
            editClothesInCloset(selectedId);
        }
    }

    private void addClothesToCloset() {
        image = new ImageView(getContext());
        image.setId(View.generateViewId());
        ConstraintLayout.LayoutParams imageParams = new ConstraintLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT);
        imageParams.width = 300;
        imageParams.height = 300;
        image.setLayoutParams(imageParams);
        image.setImageBitmap(bitmap);

        spinner = new Spinner(getContext());
        spinner.setId(View.generateViewId());
        ConstraintLayout.LayoutParams spinnerParams = new ConstraintLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT);
        spinnerParams.width = 90;
        spinnerParams.height = 90;
        spinner.setLayoutParams(spinnerParams);
        spinner.setBackgroundResource(R.drawable.dots);
        setAdapter(R.array.edit_delete_array, spinner);
        spinner.setOnItemSelectedListener(this);

        clothes = new ConstraintLayout(getContext());
        clothes.setId(View.generateViewId());
        clothes.addView(image);
        clothes.addView(spinner);
        ConstraintSet constraint = new ConstraintSet();
        constraint.clone(clothes);
        constraint.connect(spinner.getId(), ConstraintSet.RIGHT, image.getId(), ConstraintSet.RIGHT);
        constraint.applyTo(clothes);

        clothesLayout.addView(clothes);
    }

    private void editClothesInCloset(int selectedId) {
        image = root.findViewById(selectedId - 1);
        while (bitmap == null) {
            Log.d(TAG, "waiting for bitmap");
        }
        image.setImageBitmap(bitmap);
    }

    private void deleteClothesFromCloset(int selectedId) {
        clothes = root.findViewById(selectedId + 1);
        clothesLayout.removeView(clothes);
    }

    private void deleteImageFromServer() {
        OkHttpClient client = new OkHttpClient();
        Request request = new Request.Builder()
                .url("http://closet-cpen321.westus.cloudapp.azure.com/api/images/" + user.getUserId() + "/" + clothesId)
                .addHeader("Authorization", "Bearer" + user.getUserToken())
                .delete()
                .build();
        Call call = client.newCall(request);
        call.enqueue(new Callback() {
            @Override
            public void onFailure(@NotNull Call call, @NotNull IOException e) {
                e.printStackTrace();
            }

            @Override
            public void onResponse(@NotNull Call call, @NotNull Response response) throws IOException {
                String responseStr = Objects.requireNonNull(response.body().string());
                Log.d(TAG, "Successfully delete image from server: " + responseStr);
            }
        });
    }

    @Override
    public void onNothingSelected(AdapterView<?> parent) {
        Log.d(TAG, "nothing is selected");
    }

    public static CountingIdlingResource getRegisterIdlingResourceInTest() {
        return idlingResource;
    }
}